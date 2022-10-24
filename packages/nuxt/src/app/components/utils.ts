import { defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { isString, isPromise, isArray } from '@vue/shared'

const Fragment = defineComponent({
  setup (_props, { slots }) {
    return () => slots.default?.()
  }
})

/**
 * Internal utility
 *
 * @private
 */
export const _wrapIf = (component: Component, props: any, slots: any) => {
  return { default: () => props ? h(component, props === true ? {} : props, slots) : h(Fragment, {}, slots) }
}

// eslint-disable-next-line no-use-before-define
export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean }
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>

/**
 * create buffer retrieved from @vue/server-renderer
 *
 * @see https://github.com/vuejs/core/blob/9617dd4b2abc07a5dc40de6e5b759e851b4d0da1/packages/server-renderer/src/render.ts#L57
 * @private
 */
export function createBuffer () {
  let appendable = false
  const buffer: SSRBuffer = []
  return {
    getBuffer (): SSRBuffer {
      return buffer
    },
    push (item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item)
      }
      appendable = isStringItem
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true
      }
    }
  }
}
