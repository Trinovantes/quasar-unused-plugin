<script lang="ts" setup>
import { ref } from 'vue'
const counter = ref(0)
</script>

<template>
    <article>
        <h3>
            Counter: {{ counter }}
        </h3>

        <QBtn
            label="QBtn"
            @click="counter++"
        />

        <q-btn
            label="q-btn"
            @click="counter++"
        />
    </article>
</template>

<style lang="scss" scoped>
*{
    font-family: Arial, Helvetica, sans-serif;
}
</style>
