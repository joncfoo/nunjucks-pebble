#!/usr/bin/env node

const fs = require('fs')
const transform = require('./transform')

const args = process.argv.slice(2)

if (args.length < 1) {
    console.error('Usage: kusari file+')
    process.exit(1)
}

for (const arg of args) {
    if (!fs.existsSync(arg)) {
        console.error(`'${arg}' does not exist`)
        process.exit(1)
    }
}

for (const arg of args) {
    const contents = fs.readFileSync(arg).toString()
    console.log(contents)
    const fn = transform.bind(null, contents)
    try {
        console.log(fn())
    } catch (e) {
        console.log(fn(true))
    }
}
