<script setup lang="ts">
import { javascript } from '@codemirror/lang-javascript'
import { duotoneDarkInit } from '@uiw/codemirror-theme-duotone'
import { tags as t } from '@lezer/highlight'
import { debounce } from 'lodash-es'
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
  placeholder,
  EditorView,
} from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from '@codemirror/language'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import {
  closeBrackets,
  autocompletion,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'

const props = defineProps({
  modelValue: String,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'run'): void
}>()

const editor = shallowRef<EditorView>()
const editorRef = ref<HTMLElement>()

const emitUpdateDebounced = debounce((value: string) => {
  emit('update:modelValue', value)
}, 250)
const updateListener = EditorView.updateListener.of((v) => {
  emitUpdateDebounced(v.state.doc.toString())
})

const theme = EditorView.theme({
  '&': {
    fontSize: '16px',
  },
  '.cm-scroller': { fontFamily: 'inherit' },
  '&.cm-editor': {
    backgroundColor: 'transparent !important',
    outline: 'none',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent !important',
  },
  '& .cm-gutterElement': {
    display: 'flex !important',
    alignItems: 'center !important',
    justifyContent: 'center !important',
  },
  '.cm-content': {
    lineHeight: '1.8',
    padding: '0 !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent !important',
    borderRadius: '0 3px 3px 0',
  },
  '&.cm-focused .cm-activeLine': {
    backgroundColor: 'rgba(var(--color-gray-800) / 0.75) !important',
    borderRadius: '0 3px 3px 0',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent !important',
  },
  '&.cm-focused .cm-activeLineGutter': {
    backgroundColor: 'rgba(var(--color-gray-800) / 0.75) !important',
  },
  '.cm-lineNumbers .cm-activeLineGutter': {
    borderRadius: '3px 0 0 3px',
  },
})

const setup = () => [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
]

onMounted(() => {
  editor.value = new EditorView({
    extensions: [
      setup(),

      javascript({
        typescript: true,
      }),
      updateListener,
      duotoneDarkInit({
        settings: {
          foreground: 'rgb(var(--color-gray-100))',
          caret: 'rgb(var(--color-primary-500))',
          gutterForeground: 'rgb(var(--color-gray-600))',
          selection: 'rgb(var(--color-gray-600))',
          selectionMatch: 'rgb(var(--color-gray-700))',
        },
        styles: [
          { tag: [t.comment, t.bracket], color: 'rgb(var(--color-gray-400))' },
          {
            tag: [t.number],
            color: 'rgb(var(--color-primary-400))',
          },
          {
            tag: [t.atom, t.keyword, t.link, t.attributeName],
            color: 'rgb(var(--color-primary-300))',
          },
          {
            tag: [t.emphasis, t.heading, t.tagName, t.className, t.variableName],
            color: 'rgb(var(--color-gray-100))',
          },
          {
            tag: [t.propertyName],
            color: 'rgb(var(--color-gray-300))',
          },
          { tag: [t.typeName, t.url], color: '#a78bfa' },
          { tag: [t.function(t.variableName)], color: '#a78bfa' },
          { tag: [t.function(t.propertyName)], color: '#a78bfa' },
          { tag: t.operator, color: 'rgb(var(--color-primary-300))' },
          { tag: t.string, color: 'rgb(var(--color-primary-400))' },
          { tag: [t.unit, t.punctuation], color: 'rgb(var(--color-gray-400))' },
        ],
      }),
      theme,
      placeholder('Your code goes here...'),
    ],
    parent: editorRef.value,
    doc: props.modelValue,
  })
})

watch(
  () => props.modelValue,
  (value) => {
    if (editor.value) {
      if (value === editor.value.state.doc.toString()) {
        return
      }

      editor.value.dispatch({
        changes: {
          from: 0,
          to: editor.value.state.doc.length,
          insert: value,
        },
      })
    }
  },
  { immediate: true }
)

const run = () => {
  emit('run')
}

const preferences = usePreferences()
</script>

<template>
  <div
    @keydown.enter.meta.prevent.stop.capture="run"
    @keydown.enter.ctrl.prevent.stop.capture="run"
    class="font-mono p-3 rounded-md bg-gray-950 border border-gray-700 relative"
  >
    <div ref="editorRef"></div>

    <div class="absolute bottom-[0.65rem] right-2.5 flex items-end">
      <ClientOnly>
        <UTooltip
          :text="
            (preferences.typescript ? 'Disable' : 'Enable') + ' experimental TypeScript support'
          "
          :popper="{ placement: 'left' }"
        >
          <UButton
            icon="i-tabler-brand-typescript"
            variant="ghost"
            size="sm"
            :color="preferences.typescript ? 'primary' : 'gray'"
            @click="preferences.typescript = !preferences.typescript"
            :class="{ 'opacity-50': !preferences.typescript }"
          />
        </UTooltip>
      </ClientOnly>
    </div>
  </div>
</template>
