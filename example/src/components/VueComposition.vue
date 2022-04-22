<script lang="ts">
import { defineComponent, computed, defineAsyncComponent } from 'vue'

export default defineComponent({
    components: {
        Counter: defineAsyncComponent(() => import('./Counter.vue')),
    },

    props: {
        num: {
            type: Number,
            default: 1,
        },
    },

    setup(props) {
        const name = computed(() => `Composition num:${props.num}`)
        const childNum = computed(() => props.num + 1)

        return {
            name,
            childNum,
        }
    },
})
</script>

<template>
    <article>
        <h2>
            {{ name }}
        </h2>

        <VueComposition
            v-if="num < 5"
            :num="childNum"
        />
        <Counter
            v-else
        />
    </article>
</template>

<style lang="scss" scoped>
h2{
    background-color: blue;
    color: white;
}
</style>
