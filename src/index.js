#!/usr/bin/env node

const fs = require('fs')
const nunjucks = require('nunjucks')

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

const flatten = arr => arr.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [])

const nodes = nunjucks.nodes

const handler = {
    Root(ns) {
        return ns.children.map(c => transform(c, false))
    },

    Output(ns, unwrap) {
        return ns.children.map(c => transform(c, unwrap))
    },

    NodeList(ns, unwrap) {
        return ns.children.map(c => transform(c, unwrap))
    },

    TemplateData(n) {
        return n.value
    },

    Symbol(n, unwrap) {
        if (unwrap)
            return n.value
        else
            return `{{ ${n.value} }}`
    },

    Literal(n) {
        return `"${n.value.replace(/"/g, '\\"')}"`
    },

    InlineIf(n, unwrap) {
        // optimization
        // {{ x if x }} -> {{ x }}
        if (n.cond instanceof nodes.Symbol && n.body instanceof nodes.Symbol && n.cond.value === n.body.value) {
            if (unwrap)
                return n.cond.value
            else
                return `{{ ${n.cond.value} }}`
        }

        let cond = flatten(transform(n.cond, true)).join('')
        const body = flatten(transform(n.body, false)).join('')
        const else_ = flatten(transform(n.else_)).join('') || '""'

        if (n.cond instanceof nodes.Symbol) {
            // could be checking for either non-empty or true

            // if body is a literal then assume boolean?
            if (!(n.body instanceof nodes.Literal))
                cond += ' is not empty'
        }

        if (n.else_ && !unwrap) {
            console.error('InlineIf: unhandled else_')
        }

        if (unwrap)
            return `${cond} ? ${body} : ${else_}`
        else
            return `{% if ${cond} %}{{${body}}}{% endif %}`
    },

    If(n) {
        const cond = flatten(transform(n.cond, true)).join('')
        const body = flatten(transform(n.body, false)).join('')
        const else_ = flatten(transform(n.else_, false)).join('')

        if (n.else_) {
            return `{% if ${cond} %}${body}{% else %}${else_}{% endif %}`
        } else {
            return `{% if ${cond} %}${body}{% endif %}`
        }
    },

    For(n) {
        const name = flatten(transform(n.name, true)).join('')
        const value = flatten(transform(n.arr, true)).join('')
        const body = flatten(transform(n.body, false)).join('')

        if (n.else_) {
            console.error('For: unhandled else_')
        }

        return `{% for ${name} in ${value} %}${body}{% endfor %}`
    },

    Filter(n, unwrap) {
        let name = flatten(transform(n.name, true)).join('')
        const args = flatten(transform(n.args, true)).join('')

        // translation
        if (name === 'safe')
            name = 'raw'

        if (unwrap)
            return `${args} | ${name}`
        else
            return `{{ ${args} | ${name} }}`
    },

    Group(ns) {
        return ['(', ns.children.map(c => transform(c, true)), ')']
    },

    Include(n) {
        let name = flatten(transform(n.template, true)).join('')
        name = name.replace('./', '')
        return `{% include ${name} %}`
    },

    LookupVal(n, unwrap) {
        const target = flatten(transform(n.target, true)).join('')
        let val = flatten(transform(n.val, true)).join('')

        if (unwrap)
            return `${target}[${val}]`
        else
            return `{{ ${target}[${val}] }}`
    },

    Add(n) {
        const left = flatten(transform(n.left, true)).join('')
        const right = flatten(transform(n.right, true)).join('')

        return `${left} + ${right}`
    },

    Or(n) {
        const left = transform(n.left, true)
        const right = transform(n.right, true)

        return `${left} or ${right}`
    },

    And(n) {
        const left = transform(n.left, true)
        const right = transform(n.right, true)

        return `${left} and ${right}`
    },

    Not(n) {
        const target = flatten(transform(n.target, true)).join('')

        return `not ${target}`
    },

    Compare(n) {
        const expr = flatten(transform(n.expr, true)).join('')
        const ops = flatten(n.ops.map(o => transform(o, true))).join('')

        return `${expr} ${ops}`
    },

    CompareOperand(n) {
        const expr = flatten(transform(n.expr, true)).join('')

        let type = n.type

        if (type === '===')
            type = '=='

        return `${type} ${expr}`
    },
}

function transform(node, unwrap) {
    const buf = []
    if (!node)
        return []

    if (node.typename in handler) {
        buf.push(handler[node.typename](node, unwrap))
    } else {
        console.error('Unhandled', node.typename)
    }
    return buf
}

for (const arg of args) {
    const contents = fs.readFileSync(arg).toString()
    const ast = nunjucks.parser.parse(contents)

    const buf = flatten(transform(ast))
    console.log(buf.join(''))
}
