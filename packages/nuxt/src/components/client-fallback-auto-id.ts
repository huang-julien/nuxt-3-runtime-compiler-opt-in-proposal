import { genImport } from 'knitwork'
import { createUnplugin } from 'unplugin'
import { ComponentsOptions } from '@nuxt/schema'
import MagicString from 'magic-string'
import { isAbsolute, relative } from 'pathe'
import { hash } from 'ohash'
import { isVueTemplate } from './helpers'

interface LoaderOptions {
  sourcemap?: boolean
  transform?: ComponentsOptions['transform'],
  rootDir: string
}

export const clientFallbackAutoIdPlugin = createUnplugin((options: LoaderOptions) => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []

  return {
    name: 'nuxt:client-fallback-auto-id',
    enforce: 'post',
    transformInclude (id) {
      if (exclude.some(pattern => id.match(pattern))) {
        return false
      }
      if (include.some(pattern => id.match(pattern))) {
        return true
      }
      return isVueTemplate(id)
    },
    transform (code, id) {
      const s = new MagicString(code)
      const relativeID = isAbsolute(id) ? relative(options.rootDir, id) : id

      const imports = new Set()
      let hasClientFallback = false
      let count = 0
      const uidkey = 'clientFallbackUid$'

      s.replace(/(_createVNode|_ssrRenderComponent)\((.*[cC]lient-?[fF]allback),(.*),/g, (full, renderFunction, name, props) => {
        hasClientFallback = true
        // slice to remove object curly braces {}
        const oldProps = props.trim() !== 'null' ? props.trim().slice(1, -1) : ''
        // generate string to include the uidkey into the component props
        const newProps = `{ uid: $setup.${uidkey} + '${count}'${oldProps ? `, ${oldProps}` : ''} }`
        count++
        return `${renderFunction}(${name}, ${newProps} ,`
      })

      if (hasClientFallback) {
        imports.add(genImport('vue', [{ name: 'computed', as: '__computed' }]))
        s.replace(/setup ?\((.*)\) ?{/g, (full, args) => {
          const [propsName = '_props', ctxName = '_ctx'] = args.split(',')

          return `setup(${propsName}, ${ctxName}) {
            const ${uidkey} = __computed(() => "${hash(relativeID)}" + JSON.stringify(${propsName}));
          `
        })

        s.replace(/const __returned__ = {(.*)}/g, (full, content) => {
          return `const __returned__ = {${content ? content + ',' : ''} ${uidkey}}`
        })
      }
      if (imports.size) {
        s.prepend([...imports, ''].join('\n'))
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }
})
