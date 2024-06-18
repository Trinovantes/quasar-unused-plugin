<script lang="ts" setup>
import { computed, ref } from 'vue'
import SimpleCounter from './SimpleCounter.vue'

const props = defineProps({
    num: {
        type: Number,
        default: 1,
    },
})

const name = computed(() => `Composition Setup num:${props.num}`)
const childNum = computed(() => props.num + 1)
const message = ref<string | null>(null)
</script>

<template>
    <article>
        <h2>
            {{ name }}
        </h2>

        <VueCompositionSetup
            v-if="num < 5"
            :num="childNum"
        />
        <template
            v-else
        >
            <q-form>
                <q-input
                    v-model="message"
                    label="Message"
                    debounce="250"
                    outlined
                    clearable
                    :rules="[ (val: string) => val && val.length > 0 || 'Message cannot be empty' ]"
                    hide-bottom-space
                />
            </q-form>

            <SimpleCounter />
        </template>
    </article>
</template>

<style lang="scss" scoped>
h2{
    background-color: green;
    color: white;
}
</style>
