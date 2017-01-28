const nunjucks = require('nunjucks')
const nodes = nunjucks.nodes

const flatten = arr => arr.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [])
function nprint(node, spacing = 0) {
    //    nodes.printNodes(node)
    let spaces = ''
    for (let i = 0; i < spacing; i++)
        spaces += ' '

    if (node instanceof nodes.NodeList) {
        console.error(spaces, node.typename)

        node.children.forEach(c => {
            nprint(c, spacing + 2)
        })
    }
    else if (node instanceof nodes.Value) {
        console.error(spaces, node.typename, 'value:', node.value)
    }
    else if (node instanceof nodes.Node) {
        console.error(spaces, node.typename, node.fields)
        for (const f of node.fields) {
            console.error(`${spaces}  ${f}=`)
            nprint(node[f], spacing + 4)
        }
    }
}

class Wrap {
    constructor(value, left, right, wrap) {
        this.value = value
        this.left = left
        this.right = right
        this.wrap = wrap
    }

    toString() {
        const value = Array.isArray(this.value) ? flatten(this.value).join('') : this.value
        if (this.wrap)
            return this.left + value + this.right
        else
            return value
    }
}

const wrapBlock = (v, w) => new Wrap(v, '{% ', ' %}', w)
const wrapExpr = (v, w) => new Wrap(v, '{{ ', ' }}', w)
const wrapLit = (v, w) => new Wrap(v, '"', '"', w)

const BinOps = {
    'In': ' in ',
    'Add': ' + ',
    'Sub': ' - ',
    'Mul': ' * ',
    'Div': ' / ',
    'Mod': ' % ',

}

function truthy(cond, negate = false) {
    if (negate)
        // note we are re-writing the expression by avoid the `not` operator
        return ['( ', cond, ' == false or ', cond, ' is empty )']
    else
        return ['( ', cond, ' == true or ', cond, ' is not empty )']
}

const nodeHandler = {
    Root(n) {
        return n.children.map(transformer)
    },

    Output(n) {
        return n.children.map(c => transformer(c, true))
    },

    Symbol(n, wrap) {
        return wrapExpr(n.value, wrap)
    },

    TemplateData(n) {
        return n.value
    },

    LookupVal(n, wrap) {
        const target = transformer(n.target)
        const val = transformer(n.val, n.val instanceof nodes.Literal)
        return wrapExpr([target, '[', val, ']'], wrap)
    },

    Literal(n) {
        return wrapLit(n.value, n.value.toFixed ? false : true)
    },

    BinOp(n, wrap) {
        const left = transformer(n.left, n.left instanceof nodes.Literal)
        const right = transformer(n.right, n.right instanceof nodes.Literal)
        return wrapExpr([left, BinOps[n.typename], right], wrap)
    },

    Filter(n, wrap) {
        let name = n.name.value
        const args = flatten(transformer(n.args))

        if (name === 'safe')
            name = 'raw'

        if (args.length > 1)
            return wrapExpr([args[0], ' | ', name, '(', args.slice(1).join(',') , ')'], wrap)
        else
            return wrapExpr([args, ' | ', name], wrap)
    },

    NodeList(n) {
        return n.children.map(c => transformer(c, c instanceof nodes.Literal))
    },

    If(n) {
        const cond = transformer(n.cond)
        const body = transformer(n.body, true)
        const else_ = n.else_ ? transformer(n.else_) : ''

        return [wrapBlock(['if ', cond], true),
                body,
                (else_ ? [wrapBlock('else', true), else_] : ''),
                wrapBlock(['endif'], true)
               ]
    },

    InlineIf(n, wrap) {
        let cond = transformer(n.cond)
        const body = transformer(n.body)
        const else_ = n.else_ ? transformer(n.else_) : '""'

        // if condition is testing for truthiness
        if (n.cond instanceof nodes.Symbol || n.cond instanceof nodes.LookupVal) {
            cond = truthy(cond)
        }

        return wrapExpr([cond, ' ? ', body, ' : ', else_], wrap)
    },

    For(n) {
        const array = transformer(n.arr)
        const name = transformer(n.name)
        const body = transformer(n.body)

        if (n.else_) {
            throw new Error('In For block, else_ is not handled')
        }

        return [wrapBlock(['for ', name, ' in ', array], true),
                body,
                wrapBlock(['endfor'], true)
               ]
    },

    Include(n) {
        const template = flatten(transformer(n.template))[0]

        if (template.value.startsWith('./')) {
            template.value = template.value.substring(2)
        }

        return wrapBlock(['include ', template], true)
    },

    Set(n) {
        const value = transformer(n.value)
        const targets = n.targets.map(transformer)

        return wrapBlock(['set ', targets, ' = ', value], true)
    },

    Group(n, wrap) {
        const expr = n.children.map(transformer)

        return wrapExpr(['(', expr, ')'], wrap)
    },

    Dict(n) {
        const expr = flatten(n.children.map(transformer))
        const rewritten = []
        for (let i = 0, len = expr.length; i < len; i++) {
            rewritten.push(expr[i])
            if ((i + 1) % 3 === 0 && i + 1 < len)
                rewritten.push(', ')
        }
        return new Wrap(rewritten, '{', '}', true)
    },

    Pair(n) {
        const key = transformer(n.key)
        const value = transformer(n.value)
        return [`"${key}"`, ': ', value]
    },

    FunCall(n) {
        const name = transformer(n.name)
        const args = flatten(transformer(n.args))
        const rewritten = []
        for (let i = 0, len = args.length; i < len; i++) {
            rewritten.push(args[i])
            if (i+1 < len)
                rewritten.push(', ')
        }
        return [name, '(', rewritten, ')']
    },

    Not(n) {
        const target = transformer(n.target)

        return truthy(target, true)
    },

    Or(n) {
        let left = transformer(n.left)
        let right = transformer(n.right)

        if (n.left instanceof nodes.Symbol || n.left instanceof nodes.LookupVal) {
            left = truthy(left)
        }

        if (n.right instanceof nodes.Symbol || n.right instanceof nodes.LookupVal) {
            right = truthy(right)
        }

        return [left, ' or ', right]
    },

    And(n) {
        let left = transformer(n.left)
        let right = transformer(n.right)

        if (n.left instanceof nodes.Symbol || n.left instanceof nodes.LookupVal) {
            left = truthy(left)
        }

        if (n.right instanceof nodes.Symbol || n.right instanceof nodes.LookupVal) {
            right = truthy(right)
        }

        return [left, ' and ', right]
    },

    Compare(n) {
        const expr = transformer(n.expr)
        const opExpr = n.ops.map(transformer)

        return [expr, opExpr]
    },

    CompareOperand(n) {
        const expr = transformer(n.expr)
        let type = n.type

        if (type === '===')
            type = '=='
        else if (type === '!==')
            type = '!='

        return [' ', type, ' ', expr]
    }
}

Object.keys(BinOps).forEach(k => nodeHandler[k] = nodeHandler.BinOp)

function transformer(node, wrap) {
    const buf = []
    if (node == null) {
        return buf
    }

    if (node.typename in nodeHandler) {
        buf.push(nodeHandler[node.typename](node, wrap))
    } else {
        throw new Error(`Unhandled node ${node.typename}`)
    }
    return buf
}

function transform(contents, debug = false) {
    const nodes = nunjucks.parser.parse(contents)
    if (debug)
        nprint(nodes)
    const result = transformer(nodes)
    if (debug)
        console.dir(flatten(result))
    return flatten(result).join('')
}

module.exports = transform
