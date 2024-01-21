<script setup lang="ts">
// import { basicSetup } from "codemirror";
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
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
    backgroundColor: 'rgba(255,255,255,0.05) !important',
    borderRadius: '0 3px 3px 0',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent !important',
  },
  '&.cm-focused .cm-activeLineGutter': {
    backgroundColor: 'rgba(255,255,255,0.05) !important',
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
      // basicSetup,
      setup(),

      javascript(),
      updateListener,
      oneDark,
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
</script>

<template>
  <div
    @keydown.enter.meta.prevent.stop.capture="run"
    @keydown.enter.ctrl.prevent.stop.capture="run"
    class="font-mono p-3 rounded-md bg-gray-950 border border-gray-700"
  >
    <div ref="editorRef"></div>
  </div>
</template>
