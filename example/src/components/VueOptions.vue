<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue'

export default defineComponent({
    components: {
        SimpleCounter: defineAsyncComponent(() => import('./SimpleCounter.vue')),
    },

    props: {
        num: {
            type: Number,
            default: () => 1,
        },
    },

    computed: {
        name() {
            return `Options num:${this.num}`
        },
        childNum() {
            return this.num + 1
        },
    },
})
</script>

<template>
    <article>
        <h2>
            {{ name }}
        </h2>

        <VueOptions
            v-if="num < 5"
            :num="childNum"
        />
        <SimpleCounter
            v-else
        />
    </article>
</template>

<style lang="scss" scoped>
h2{
    background-color: red;
    color: white;
}
</style>
