/* eslint-env es6, node, mocha */
/* eslint-disable no-unused-vars, no-undef, node/no-unpublished-require */

const should = require('chai').should()
const suite = require('mocha').suite
const test = require('mocha').test

const tr = require('../src/transform')

suite('Simple expressions', () => {

    test('Symbol', () => {
        const result = tr('{{ foo }}')

        result.should.eq('{{ foo }}')
    })

    test('Text', () => {
        const result = tr('hi there {{ name }}, how do you do?')
        result.should.eq('hi there {{ name }}, how do you do?')
    })

    test('Property', () => {
        const result = tr('hi {{ person.name }}')
        result.should.eq('hi {{ person["name"] }}')
    })

    test('Property extended', () => {
        const result = tr('hi {{ person.name.first }}')
        result.should.eq('hi {{ person["name"]["first"] }}')
    })

    test('Property indexed', () => {
        const result = tr('hi {{ person.name[0].bar }}')
        result.should.eq('hi {{ person["name"][0]["bar"] }}')
    })

    test('Binary', () => {
        const result = tr('{{ 0 + 4 }} is 4')
        result.should.eq('{{ 0 + 4 }} is 4')
    })

    test('String + string', () => {
        const result = tr(`{{"foo bar" + "wat"}}`)
        result.should.eq('{{ "foo bar" + "wat" }}')
    })

    test('String + symbol', () => {
        const result = tr(`{{"foo bar" + nyaa}}`)
        result.should.eq('{{ "foo bar" + nyaa }}')
    })

    test('Symbol + number', () => {
        const result = tr(`{{ nyaa + 4 * 2}}`)
        result.should.eq('{{ nyaa + 4 * 2 }}')
    })

    test('Filter', () => {
        const result = tr(`{{ 'nyaa' | foo }}`)
        result.should.eq('{{ "nyaa" | foo }}')
    })

    test('Filter symbol', () => {
        const result = tr(`{{ nyaa | foo }}`)
        result.should.eq('{{ nyaa | foo }}')
    })

    test('Filter arguments', () => {
        const result = tr(`{{ nyaa | join(",", wat,  "nonsense") }}`)
        result.should.eq('{{ nyaa | join(",",wat,"nonsense") }}')
    })

    test('Filter chain', () => {
        const result = tr(`{{ nyaa | join(",") | superduper('sweet') }}`)
        result.should.eq('{{ nyaa | join(",") | superduper("sweet") }}')
    })

    test('Set expression', () => {
        const result = tr(`{% set x = bar.nyaa %}hello {{ x }}`)
        result.should.eq(`{% set x = bar["nyaa"] %}hello {{ x }}`)
    })

    test('Set expression with BinOp', () => {
        const result = tr(`{% set x = 'foo' + bar.nyaa %}hello {{ x }}`)
        result.should.eq(`{% set x = "foo" + bar["nyaa"] %}hello {{ x }}`)
    })

    test('Set expression with InlineIf', () => {
        const result = tr(`{% set x = 'foo' + (bar.nyaa if bar else 'derp') %}hello {{ x }}`)
        result.should.eq(`{% set x = "foo" + (( bar == true or bar is not empty ) ? bar["nyaa"] : "derp") %}hello {{ x }}`)
    })

    test('Group', () => {
        const result = tr(`{{ ('foo' + bar if bar) }}`)
        result.should.eq('{{ (( bar == true or bar is not empty ) ? "foo" + bar : "") }}')
    })
})

suite('If expressions', () => {
    test('Block simple', () => {
        const result = tr(`{% if foo %}{{ bar | baz('nya') }}{% endif %}`)
        result.should.eq(`{% if foo %}{{ bar | baz("nya") }}{% endif %}`)
    })

    test('Block simple else', () => {
        const result = tr(`{% if foo %}{{ bar | baz('nya') }}{% else %}foo {{ ack }} bar{% endif %}`)
        result.should.eq(`{% if foo %}{{ bar | baz("nya") }}{% else %}foo {{ ack }} bar{% endif %}`)
    })

    test('Inline simple', () => {
        const result = tr(`hello{{' there ' + name if name }}!`)
        result.should.eq(`hello{{ ( name == true or name is not empty ) ? " there " + name : "" }}!`)
    })

    test('Inline simple else', () => {
        const result = tr(`hello{{' there ' + name.first if name.x else 'stranger' }}!`)
        result.should.eq(`hello{{ ( name["x"] == true or name["x"] is not empty ) ? " there " + name["first"] : "stranger" }}!`)
    })
})

suite('Include', () => {
    test('Include', () => {
        const result = tr(`hi {% include './foo.html' %}`)
        result.should.eq('hi {% include "foo.html" %}')
    })
})

suite('For block', () => {
    test('Block', () => {
        const result = tr(`{% for name in people.names %}Hi {{ name}}{% endfor %}`)
        result.should.eq(`{% for name in people["names"] %}Hi {{ name }}{% endfor %}`)
    })
})

suite('Dictionary', () => {
    test('Dictionary', () => {
        const result = tr(`{% set x = {foo: 'bar', kitty: meow} %}{{ x.foo }}`)
        result.should.eq(`{% set x = {"foo": "bar", "kitty": meow} %}{{ x["foo"] }}`)
    })
})

suite('Function call', () => {
    test('Function call', () => {
        const result = tr(`{% for x in pyow('dodge', 1 + 2, cat) %}{{ x }}{% endfor %}`)
        result.should.eq(`{% for x in pyow("dodge", 1 + 2, cat) %}{{ x }}{% endfor %}`)
    })
})

suite('Operators', () => {
    test('Not', () => {
        const result = tr(`{% if not bar %}hi{% endif %}`)
        result.should.eq(`{% if ( bar == false or bar is empty ) %}hi{% endif %}`)
    })

    test('And', () => {
        const result = tr(`{{ 'nyaa' if foo and not bar }}`)
        result.should.eq(`{{ ( foo == true or foo is not empty ) and ( bar == false or bar is empty ) ? "nyaa" : "" }}`)
    })

    test('Or', () => {
        const result = tr(`{{ 'nyaa' if foo or not bar }}`)
        result.should.eq(`{{ ( foo == true or foo is not empty ) or ( bar == false or bar is empty ) ? "nyaa" : "" }}`)
    })

    test('Compare', () => {
        const result = tr(`{% if foo === 'bar' %}meow{% endif %}`)
        result.should.eq(`{% if foo == "bar" %}meow{% endif %}`)
    })
})
