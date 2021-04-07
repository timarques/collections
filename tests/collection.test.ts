import { Collection, AsyncCollection } from "../lib"

import 'jest-extended'

test("collection", () => {

    let collection = new Collection(function*() {
        yield 1
        yield 2
        yield 3
    })

    expect([...collection]).toEqual([1, 2, 3])
    expect([...collection]).toEqual([1, 2, 3])
    expect(collection.next().value).toEqual(1)
    expect(collection.next().value).toEqual(2)
    expect([...collection]).toEqual([3])
    expect(collection.next().value).toEqual(1)
    collection.return()
    expect([...collection]).toEqual([1, 2, 3])
    const mockMapWhile = jest.fn(value => value === 3 ? null : value * 2)
    expect([...collection.mapWhile(mockMapWhile)]).toEqual([2, 4])
    expect(mockMapWhile).toBeCalledTimes(3)
    const mockMapWhile2 = jest.fn(() => null)
    expect([...collection.mapWhile(mockMapWhile2)]).toEqual([])
    expect(mockMapWhile2).toBeCalledTimes(1)
    expect([...collection.takeWhile(() => false)]).toEqual([1])
    expect([...collection.takeWhile(value => value < 2)]).toEqual([1, 2])
    for(const value of collection) {
        if (value === 1) break
    }
    expect([...collection]).toEqual([1, 2, 3])
    expect(collection.first()).toEqual(1)
    expect(collection.last()).toEqual(3)
    expect(collection.exists(3)).toBeTruthy()
    // @ts-ignore
    expect(collection.exists(4)).toBeFalsy()
    expect(collection.nth(2)).toBe(3)
    expect(collection.nth(3)).toBeUndefined()
    expect(collection.position(2)).toBe(1)
    // @ts-ignore
    expect(collection.position(4)).toBe(-1)
    expect(collection.size()).toBe(3)
    const mockForEach = jest.fn(x => undefined)
    collection.forEach(mockForEach)
    expect(mockForEach).toBeCalledTimes(3)
    expect([...collection.skip(1)]).toEqual([2, 3])
    expect([...collection.take(1)]).toEqual([1])
    const mockTakeWhile = jest.fn(value => value > 1)
    expect([...collection.takeWhile(mockTakeWhile)]).toEqual([1])
    expect(mockTakeWhile).toBeCalledTimes(1)
    const mockTakeWhile2 = jest.fn(value => value > 0)
    expect([...collection.takeWhile(mockTakeWhile2)]).toEqual([1, 2, 3])
    expect(mockTakeWhile2).toBeCalledTimes(3)
    const mockSkipWhile = jest.fn(value => value < 2)
    expect([...collection.skipWhile(mockSkipWhile)]).toEqual([2, 3])
    expect(mockSkipWhile).toBeCalledTimes(1)
    expect(collection.fold(0, (accumulator, value) => accumulator += value)).toBe(6)
    expect(collection.collect()).toEqual([1, 2, 3])
    expect(collection.enumerate().collect()).toEqual([[0, 1], [1, 2], [2, 3]])
    expect(collection.cycle().take(6).collect()).toEqual([1, 2, 3, 1, 2, 3])
    expect(collection.chain(new Collection(function*() {
        yield 4
    })).collect()).toEqual([1, 2, 3, 4])
    const mockFilter = jest.fn(value => value !== 2)
    expect(collection.filter(mockFilter).collect()).toEqual([1, 3])
    expect(mockFilter).toBeCalledTimes(3)
    const mockFilterMap = jest.fn(value => value === 2 ? undefined : value * 2)
    expect(collection.filterMap(mockFilterMap).collect()).toEqual([2, 6])
    expect(mockFilterMap).toHaveBeenCalledTimes(3)
    const mockFind = jest.fn(value => value === 2)
    expect(collection.find(mockFind)).toEqual(2)
    expect(mockFind).toBeCalledTimes(2)
    expect(collection.find(() => false)).toBeUndefined()
    expect(collection.findMap(value => value === 3 ? true : undefined)).toEqual(true)
    expect(collection.every(value => value < 7)).toEqual(true)
    expect(collection.every(value => value < 2)).toEqual(false)
    expect(collection.every(value => false)).toEqual(false)
    expect(collection.some(value => value === 3)).toEqual(true)
    // @ts-ignore
    expect(collection.some(value => value === 4)).toEqual(false)
    expect(collection.chain([4,5]).collect()).toEqual([1, 2, 3, 4, 5])
    expect(collection.map(value => value.toString()).collect()).toEqual(["1", "2", "3"])
    expect(collection.pipe(value => value === 3 ? "position:" + value : undefined).collect()).toEqual(["position:3"])
    const mockPipe = jest.fn(value => value === 2 ? null : undefined)
    expect(collection.pipe(mockPipe).collect()).toEqual([])
    expect(mockPipe).toBeCalledTimes(2)
    expect(collection.clone().collect()).toEqual([1, 2, 3])
    const collectionOfCollections = new Collection(function*() {
        yield new Collection(function*() {
            yield 1
            yield 2
            yield new Collection(function*() {
                yield 3
                yield 4
            })
        })
    })
    expect(collectionOfCollections.flat().collect()).toEqual([1, 2, 3, 4])
    expect(collectionOfCollections.flatMap(value => value * 2).collect()).toEqual([2, 4, 6, 8])
    expect(new Collection([1, 2, 3]).enumerate().fold(0, (accumulator, [key, value]) => {
        return accumulator + key * value
    })).toEqual(8)
})

test("async-collection", () => {
    const commonCollection = new AsyncCollection(function*() {
        yield 1
        yield 2
        yield 3
    })
    expect(commonCollection.collect()).resolves.toEqual([1, 2, 3])
    const asyncCollection = new AsyncCollection(async function*() {
        yield Promise.resolve(1)
        yield Promise.resolve(2)
        yield Promise.resolve(3)
    })
    expect(asyncCollection.collect()).resolves.toEqual([1, 2, 3])
    expect(asyncCollection.chain(asyncCollection.clone()).collect()).resolves.toIncludeSameMembers([1, 2, 3, 1, 2, 3])
    expect(Promise.all([asyncCollection.collect(), asyncCollection.clone().collect()])).resolves.toIncludeSameMembers([1])
})