<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { X } from '@lucide/vue';

defineProps<{ title: string; dismissible?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

const focusable = () =>
  Array.from(
    panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? [],
  );

function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close');
  if (event.key !== 'Tab') return;
  const elements = focusable();
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement | null;
  document.addEventListener('keydown', keydown);
  await nextTick();
  (panel.value?.querySelector<HTMLElement>('input') ?? focusable()[0])?.focus();
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keydown);
  previousFocus?.focus();
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <section
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      class="glass-strong relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-6 sm:p-8"
    >
      <button
        type="button"
        class="absolute top-4 right-4 grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-white"
        aria-label="Fermer"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
      <h2 class="pr-10 font-display text-2xl">{{ title }}</h2>
      <div class="mt-5"><slot /></div>
    </section>
  </div>
</template>
