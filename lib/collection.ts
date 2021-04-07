type Parameter<T> = Iterable<T> | (() => Iterable<T>)
type NestedList<T> = T extends Collection<infer U> ? NestedList<U> : T
type ReturnType<T> = T extends number ? number : T extends string ? string : T

class Collection<T> implements IterableIterator<T> {

	protected readonly generate: () => Iterable<T>
	protected iterator: Iterator<T>

	constructor(parameter: Parameter<T>) {
		this.generate = typeof parameter === "function" ? parameter : () => parameter
		this.iterator = this.generate()[Symbol.iterator]()
	}

	next(): IteratorResult<T> {
		const result = this.iterator.next()
		if (result.done) this.iterator = this.generate()[Symbol.iterator]()
		return result
	}

	return(value?: T): IteratorResult<T> {
		this.iterator = this.generate()[Symbol.iterator]()
		return { done: true, value }
	}

	// yield then break
	takeWhile(callback: (value: T) => boolean): Collection<ReturnType<T>> {
		const collection = this.clone()
		return new Collection(function *() {
			for (const value of collection) {
				yield value as ReturnType<T>
				if (!callback(value)) break
			}
		})
	}

	// skip/break then yield
	skipWhile(callback: (value: T) => boolean): Collection<ReturnType<T>> {
		const collection = this.clone()
		return new Collection(function *() {
			let skipped = false
			for (const value of collection) {
				if (!skipped && callback(value)) {
					skipped = true
					continue
				}
				yield value as ReturnType<T>
			}
		})
	}

	take(length: number): Collection<ReturnType<T>> {
		let count = 0
		return this.takeWhile(() => ++count < length)
	}

	skip(length: number): Collection<ReturnType<T>> {
		let count = 0
		return this.skipWhile(() => count++ < length)
	}

	first(): T | undefined {
		return this[Symbol.iterator]().next().value
	}

	last(): T | undefined {
		let previousResult: IteratorResult<T> | undefined
		while (true) {
			const result = this.next()
			if (result.done) return previousResult?.value
			previousResult = result
		}
	}

	exists(target: T): boolean {
		return this.some(value => value === target)
	}

	nth(position: number): T | undefined {
		let index = 0
		for (const value of this) {
			if (index === position) return value
			index++
		}
		return undefined
	}

	position(target: T): number {
		let count = 0
		return this.some(value => {
			if (value === target) return true
			count++
			return false
		}) ? count : -1
	}

	size(): number {
		let count = 0
		this.forEach(() => count++)
		return count
	}

	forEach(callback: (value: T) => void): void {
		for (const value of this) {
			callback(value)
		}
	}

	mapWhile<TReturn>(callback: (value: T) => TReturn | null): Collection<TReturn> {
		const collection = this.clone()
		return new Collection(function* () {
			for (const value of collection) {
				const result = callback(value)
				if (result === null) break
				yield result
			}
		})
	}

	map<TReturn>(callback: (value: T) => TReturn): Collection<TReturn> {
		return this.mapWhile(callback)
	}

	fold<TReturn>(
		accumulator: TReturn, 
		callback: (accumulator: TReturn, value: T) => TReturn
	): TReturn {
		for (const value of this) {
			accumulator = callback(accumulator, value)
		}
		return accumulator
	}

	filter(callback: (value: T) => boolean): Collection<ReturnType<T>> {
		const collection = this.clone()
		return new Collection(function*() {
			for (const value of collection) {
				if (callback(value)) yield value as ReturnType<T>
			}
		})
	}

	filterMap<TReturn>(callback: (value: T) => TReturn | undefined | null): Collection<TReturn> {
		const collection = this.clone()
		return new Collection(function*() {
			for (const value of collection) {
				const result = callback(value)
				if (result !== null && result !== undefined) yield result
			}
		})
	}

	find(callback: (value: T) => boolean): T | undefined {
		return this.filter(callback)[Symbol.iterator]().next().value
	}

	findMap<TReturn>(callback: (value: T) => TReturn | null | undefined): TReturn | undefined {
		for (const value of this) {
			const result = callback(value)
			if (result !== null && result !== undefined) return result
		}
		return undefined
	}

	every(callback: (value: T) => boolean): boolean {
		return !this.find(value => !callback(value))
	}

	some(callback: (value: T) => boolean): boolean {
		return !!this.find(callback)
	}

	chain(other: Parameter<ReturnType<T>>): Collection<ReturnType<T>> {
		const collection = this.clone()
		const generate = typeof other === "function" ? other : () => other
		return new Collection(function* () {
			yield *collection as Collection<ReturnType<T>>
			yield *generate()
		})
	}

	collect(): T[] {
		return [...this]
	}

	cycle(): Collection<T> {
		const collection = this.clone()
		return new Collection(function* () {
			let consumed = false
			while (true) {
				const result = collection.next()
				if (result.done === true) {
					if (consumed) break
					consumed = true
					continue
				}
				consumed = false
				yield result.value
			}
		})
	}

	enumerate(): Collection<[number, T]> {
		const collection = this.clone()
		return new Collection(function*() {
			let index = 0
			for (const value of collection) {
				yield [index, value]
				index++
			}
		})
	}

	private *_flatMap <TCollection extends Collection<any>, TReturn>(
        collection: TCollection, 
        callback: (value: NestedList<T>) => TReturn
    ): Generator<TReturn> {
        for (const value of collection) {
            if (value instanceof Collection) yield* this._flatMap(value, callback)
            else yield callback(value)
        }
    }

    flatMap<TReturn>(callback: (value: NestedList<T>) => TReturn): Collection<TReturn> {
        return new Collection(this._flatMap(this, callback))
    }

    flat(): Collection<NestedList<T>> {
        return this.flatMap(value => value)
    }

	pipe<TReturn>(callback: (value: T) => TReturn): Collection<TReturn> {
		const collection = this.clone()
        return new Collection(function* () {
			for (const value of collection) {
				const result = callback(value)
				if (result === null) break
				else if(result === undefined) continue
				yield result
			}
		})
    }

	clone() {
		return new Collection(this.generate)
	}

	[Symbol.iterator](): IterableIterator<T> {
		return this
	}

}

export default Collection