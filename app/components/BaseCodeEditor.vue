<script setup lang="ts">
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { duotoneDarkInit, duotoneLightInit } from '@uiw/codemirror-theme-duotone'
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
import { Compartment, EditorState } from '@codemirror/state'
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

type CodeEditorLanguage = 'javascript' | 'html'

const props = withDefaults(
  defineProps<{
    ariaLabel?: string
    language?: CodeEditorLanguage
    modelValue?: string
  }>(),
  { language: 'javascript', modelValue: '' }
)

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

const baseTheme = EditorView.theme({
  '&': {
    fontSize: '16px',
    maxWidth: '100%',
    minWidth: '0',
    width: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    overflowX: 'auto',
  },
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
    backgroundColor:
      'color-mix(in oklab, var(--benchmark-editor-active-line) 75%, transparent) !important',
    borderRadius: '0 3px 3px 0',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent !important',
  },
  '&.cm-focused .cm-activeLineGutter': {
    backgroundColor:
      'color-mix(in oklab, var(--benchmark-editor-active-line) 75%, transparent) !important',
  },
  '.cm-lineNumbers .cm-activeLineGutter': {
    borderRadius: '3px 0 0 3px',
  },
})

type EditorColorMode = 'light' | 'dark'

const createEditorColorTheme = (mode: EditorColorMode) => {
  const isDark = mode === 'dark'
  const createTheme = isDark ? duotoneDarkInit : duotoneLightInit
  const primaryStrong = isDark ? 'var(--ui-color-primary-300)' : 'var(--ui-color-primary-700)'
  const primary = isDark ? 'var(--ui-color-primary-400)' : 'var(--ui-color-primary-600)'
  const purple = isDark ? '#a78bfa' : '#6d28d9'

  return createTheme({
    theme: mode,
    settings: {
      background: 'transparent',
      foreground: isDark ? 'var(--color-gray-100)' : 'var(--ui-text-highlighted)',
      caret: 'var(--ui-color-primary-500)',
      gutterBackground: 'transparent',
      gutterForeground: isDark ? 'var(--color-gray-600)' : 'var(--ui-text-muted)',
      selection: isDark ? 'var(--color-gray-600)' : 'var(--ui-bg-accented)',
      selectionMatch: isDark ? 'var(--color-gray-700)' : 'var(--ui-border-accented)',
      lineHighlight: 'transparent',
    },
    styles: [
      { tag: [t.comment, t.bracket], color: 'var(--ui-text-muted)' },
      { tag: [t.number], color: primary },
      { tag: [t.atom, t.keyword, t.link, t.attributeName], color: primaryStrong },
      {
        tag: [t.emphasis, t.heading, t.tagName, t.className, t.variableName],
        color: isDark ? 'var(--color-gray-100)' : 'var(--ui-text-highlighted)',
      },
      { tag: [t.propertyName], color: 'var(--ui-text-toned)' },
      { tag: [t.typeName, t.url], color: purple },
      { tag: [t.function(t.variableName)], color: purple },
      { tag: [t.function(t.propertyName)], color: purple },
      { tag: t.operator, color: primaryStrong },
      { tag: t.string, color: primary },
      { tag: [t.unit, t.punctuation], color: 'var(--ui-text-muted)' },
    ],
  })
}

const colorMode = useColorMode()
const colorTheme = new Compartment()
const resolvedColorMode = (): EditorColorMode => (colorMode.value === 'dark' ? 'dark' : 'light')
const languageExtension = () =>
  props.language === 'html' ? html() : javascript({ typescript: true })
const editorPlaceholder = () =>
  props.language === 'html' ? 'Optional body markup goes here...' : 'Your code goes here...'

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

      languageExtension(),
      updateListener,
      EditorView.contentAttributes.of({
        'aria-label': props.ariaLabel || editorPlaceholder(),
      }),
      colorTheme.of(createEditorColorTheme(resolvedColorMode())),
      baseTheme,
      placeholder(editorPlaceholder()),
    ],
    parent: editorRef.value,
    doc: props.modelValue,
  })
})

watch(
  () => colorMode.value,
  () => {
    editor.value?.dispatch({
      effects: colorTheme.reconfigure(createEditorColorTheme(resolvedColorMode())),
    })
  }
)

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

watch(
  () => props.ariaLabel,
  (value) => editor.value?.contentDOM.setAttribute('aria-label', value || editorPlaceholder())
)

const run = () => {
  emit('run')
}

const preferences = usePreferences()

onBeforeUnmount(() => {
  emitUpdateDebounced.flush()
  emitUpdateDebounced.cancel()
  editor.value?.destroy()
})
</script>

<template>
  <div
    @keydown.enter.meta.prevent.stop.capture="run"
    @keydown.enter.ctrl.prevent.stop.capture="run"
    class="relative w-full min-w-0 max-w-full rounded-md border border-accented bg-muted p-3 font-mono dark:bg-gray-950"
  >
    <div ref="editorRef" class="w-full min-w-0 max-w-full"></div>

    <div
      v-if="props.language === 'javascript'"
      class="absolute bottom-[0.65rem] right-2.5 flex items-end"
    >
      <ClientOnly>
        <UTooltip
          :text="
            (preferences.typescript ? 'Disable' : 'Enable') + ' experimental TypeScript support'
          "
          :content="{ side: 'left' }"
        >
          <UButton
            icon="i-tabler-brand-typescript"
            variant="ghost"
            size="md"
            :color="preferences.typescript ? 'primary' : 'neutral'"
            @click="preferences.typescript = !preferences.typescript"
            :class="{ 'opacity-50': !preferences.typescript }"
          />
        </UTooltip>
      </ClientOnly>
    </div>
  </div>
</template>
