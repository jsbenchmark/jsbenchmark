<script setup lang="ts">
import { EditorView, basicSetup } from "codemirror";
import { placeholder } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

const props = defineProps({
  modelValue: String,
});

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const editor = shallowRef<EditorView>();
const editorRef = ref<HTMLElement>();

const updateListener = EditorView.updateListener.of((v) => {
  console.log("change", v.state.doc.toString());

  emit("update:modelValue", v.state.doc.toString());
});

const theme = EditorView.theme({
  "&": {
    fontSize: "16px",
  },
  ".cm-scroller": { fontFamily: "inherit" },
  "&.cm-editor": {
    backgroundColor: "transparent !important",
    outline: "none",
  },
  ".cm-gutters": {
    backgroundColor: "transparent !important",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent !important",
    borderRadius: "0 3px 3px 0",
  },
  "&.cm-focused .cm-activeLine": {
    backgroundColor: "rgba(255,255,255,0.05) !important",
    borderRadius: "0 3px 3px 0",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent !important",
  },
  "&.cm-focused .cm-activeLineGutter": {
    backgroundColor: "rgba(255,255,255,0.05) !important",
  },
  ".cm-lineNumbers .cm-activeLineGutter": {
    borderRadius: "3px 0 0 3px",
  },
});

onMounted(() => {
  console.log(props.modelValue);

  editor.value = new EditorView({
    extensions: [
      basicSetup,
      javascript(),
      updateListener,
      oneDark,
      theme,
      placeholder("Your code goes here..."),
    ],
    parent: editorRef.value,
    doc: props.modelValue,
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (editor.value) {
      if (value === editor.value.state.doc.toString()) {
        return;
      }

      editor.value.dispatch({
        changes: {
          from: 0,
          to: editor.value.state.doc.length,
          insert: value,
        },
      });
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="font-mono p-3 rounded-md bg-gray-950 border border-gray-700">
    <div ref="editorRef"></div>
  </div>
</template>
