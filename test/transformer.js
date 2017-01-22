/* eslint-env es6, node, mocha */
/* eslint-disable no-unused-vars, no-undef, node/no-unpublished-require */

const should = require('chai').should()
const suite = require('mocha').suite
const test = require('mocha').test

const tr = require('../src/transform')

suite('Simple Expressions', () => {

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

    test('String + String', () => {
        const result = tr(`{{"foo bar" + "wat"}}`)
        result.should.eq('{{ "foo bar" + "wat" }}')
    })

    test('String + Symbol', () => {
        const result = tr(`{{"foo bar" + nyaa}}`)
        result.should.eq('{{ "foo bar" + nyaa }}')
    })

    test('Symbol + Number', () => {
        const result = tr(`{{ nyaa + 4 * 2}}`)
        result.should.eq('{{ nyaa + 4 * 2 }}')
    })

    test('Filter', () => {
        const result = tr(`{{ 'nyaa' | foo }}`)
        result.should.eq('{{ "nyaa" | foo }}')
    })

    test('Filter Symbol', () => {
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
})

suite('If Block Expression', () => {
    test('Block simple', () => {
        const result = tr(`{% if foo %}{{ bar | baz('nya') }}{% endif %}`)
        result.should.eq(`{% if foo %}{{ bar | baz("nya") }}{% endif %}`)
    })

    test('Block simple else', () => {
        const result = tr(`{% if foo %}{{ bar | baz('nya') }}{% else %}foo {{ ack }} bar{% endif %}`)
        result.should.eq(`{% if foo %}{{ bar | baz("nya") }}{% else %}foo {{ ack }} bar{% endif %}`)
    })
})
