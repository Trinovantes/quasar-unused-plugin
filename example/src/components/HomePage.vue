<script lang="ts" setup>
import SimpleCounter from './SimpleCounter.vue'
import { QBtn } from 'quasar'

const onIntersect = () => {
    // Use the variable so it doesn't get tree shaked
    console.info(QBtn)
    return false // Stop observer after first intersection
}
</script>

<template>
    <article>
        <h1
            v-intersection="{
                handler: onIntersect,
            }"
        >
            HomePage
        </h1>

        <SimpleCounter />
    </article>
</template>
