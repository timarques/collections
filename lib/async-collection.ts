type Parameter<T> = (
	(
		() => (
			AsyncIterableIterator<T> |
			AsyncIterable<T> |
			IterableIterator<T> |
			Iterable<T>
		)
	) |
	AsyncIterable<T> |
	AsyncIterableIterator<T> |
	IterableIterator<T> |
	Iterable<T>
)
type NestedValue<T> = T extends AsyncCollection<infer U> ? NestedValue<U> : T
type ReturnType<T> = T extends number ? number : T extends string ? string : T

class AsyncCollection<T> implements AsyncIterableIterator<T> {

	static fromCollection<T>(parameter: Parameter<T>) {
		const generate = typeof parameter === "function" ? parameter : () => parameter
		return new AsyncCollection(async function* (){
			yield* generate()
		})
	}

    protected readonly generate: () => AsyncIterable<T> | Iterable<T>
	protected readonly consume: boolean
	protected iterator: AsyncIterator<T> | Iterator<T>

	constructor(parameter: Parameter<T>, consume: boolean = true) {
		this.consume = consume
		this.generate = typeof parameter === "function" ? parameter : () => parameter
		this.iterator = this.createIterator()
	}

	private createIterator(): AsyncIterator<T> | Iterator<T> {
		const iterable = this.generate()
		// @ts-ignore
		return Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]()
	}

	async next(): Promise<IteratorResult<T>> {
		const item = await this.iterator.next()
		if (item.done && !this.consume) this.iterator = this.createIterator()
		return item
	}

	return (value?: T): Promise<IteratorResult<T>> {
		if (!this.consume) this.iterator = this.createIterator()
		return Promise.resolve({ done: true, value })
	}

	takeWhile(callback: (value: T) => boolean | Promise<boolean>): AsyncCollection<ReturnType<T>> {
		const collection = this.clone()
		return new AsyncCollection(async function *() {
			for await (const value of collection) {
				yield value as ReturnType<T>
				if (!await callback(value)) break
			}
		})
	}

	skipWhile(callback: (value: T) => boolean | Promise<boolean>): AsyncCollection<ReturnType<T>> {
		const collection = this.clone()
		return new AsyncCollection(async function *() {
			let skipped = false
			for await (const value of collection) {
				if (!skipped && callback(value)) {
					skipped = true
					continue
				}
				yield value as ReturnType<T>
			}
		})
	}

	take(length: number): AsyncCollection<ReturnType<T>> {
		let count = 0
		return this.takeWhile(() => ++count < length)
	}

	skip(length: number): AsyncCollection<ReturnType<T>> {
		let count = 0
		return this.skipWhile(() => count++ < length)
	}

	async first(): Promise<T | undefined> {
		return (await this[Symbol.asyncIterator]().next()).value
	}

	async last(): Promise<T | undefined> {
		let previousResult: IteratorResult<T> | undefined
		while (true) {
			const result = await this.next()
			if (result.done) return previousResult?.value
			previousResult = result
		}
	}

	exists(target: T): Promise<boolean> {
		return this.some(value => value === target)
	}

	async nth(position: number): Promise<T | undefined> {
		let index = 0
		for await (const value of this) {
			if (index === position) return value
			index++
		}
		return undefined
	}

	async position(target: T): Promise<number> {
		let count = 0
		return await this.some(value => {
			if (value === target) return true
			count++
			return false
		}) ? count : -1
	}

	async size(): Promise<number> {
		let count = 0
		await this.forEach(() => void count++)
		return count
	}

	async forEach(callback: (value: T) => void | Promise<void>): Promise<void> {
		for await (const value of this) {
			await callback(value)
		}
	}

    mapWhile<TReturn>(callback: (value: T) => TReturn | null | Promise<TReturn | null>): AsyncCollection<TReturn> {
		const collection = this.clone()
		return new AsyncCollection(async function* () {
			for await (const value of collection) {
				const result = await callback(value)
				if (result === null) break
				yield result
			}
		})
	}

	map<TReturn>(callback: (value: T) => TReturn | Promise<TReturn>): AsyncCollection<TReturn> {
		return this.mapWhile(callback)
	}

	async fold<TReturn>(
		accumulator: TReturn,
		callback: (accumulator: TReturn, value: T) => TReturn | Promise<TReturn>
	): Promise<TReturn> {
		for await (const value of this) {
			accumulator = await callback(accumulator, value)
		}
		return accumulator
	}

	filter(callback: (value: T) => boolean | Promise<boolean>): AsyncCollection<ReturnType<T>> {
		const collection = this.clone()
		return new AsyncCollection(async function*() {
			for await (const value of collection) {
				if (await callback(value)) yield value as ReturnType<T>
			}
		})
	}

	filterMap<TReturn>(callback: (value: T) => TReturn | null | undefined | Promise<TReturn | null | undefined>): AsyncCollection<TReturn> {
		const collection = this.clone()
		return new AsyncCollection(async function* () {
			for await (const value of collection) {
				const result = await callback(value)
				if (result !== null && result !== undefined) yield result
			}
		})
	}

	async find(callback: (value: T) => boolean | Promise<boolean>): Promise<T | undefined> {
        const collection = this.filter(callback)
        const item = await collection[Symbol.asyncIterator]().next()
		return item.value
	}

	async findMap<TReturn>(
        callback: (value: T) => TReturn | null | undefined | Promise<TReturn | null | undefined>
    ): Promise<TReturn | undefined> {
		for await (const value of this) {
			const result = await callback(value)
			if (result !== null && result !== undefined) return result
		}
		return undefined
	}

	async every(callback: (value: T) => boolean | Promise<boolean>): Promise<boolean> {
		return !await this.find(async value => !await callback(value))
	}

	async some(callback: (value: T) => boolean | Promise<boolean>): Promise<boolean> {
		return !!await this.find(callback)
	}

	chain(other: Parameter<ReturnType<T>>): AsyncCollection<ReturnType<T>> {
		const collection = this.clone()
		const generate = typeof other === "function" ? other : () => other
		return new AsyncCollection(async function*() {
			yield *collection as AsyncCollection<ReturnType<T>>
			yield *generate()
		})
	}

	async collect(): Promise<T[]> {
		const result = await this.fold([] as T[], (accumulator, value) => accumulator.concat(value))
		return result
	}

	cycle(): AsyncCollection<T> {
		const collection = this.clone()
		return new AsyncCollection(async function* () {
			let consumed = false
			while (true) {
				const result = await collection.next()
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

	enumerate(): AsyncCollection<[number, T]> {
		const collection = this.clone()
		return new AsyncCollection(async function*() {
			let index = 0
			for await (const value of collection) {
				yield [index, value] as [number, T]
				index++
			}
		})
	}

	private async *_flatMap <TCollection extends AsyncCollection<any>, TReturn>(
        collection: TCollection, 
        callback: (value: NestedValue<T>) => TReturn | Promise<TReturn>
    ): AsyncGenerator<TReturn> {
        for await (const value of collection) {
            if (value instanceof AsyncCollection) yield* this._flatMap(value, callback)
            else yield await callback(value)
        }
    }

    flatMap<TReturn>(callback: (value: NestedValue<T>) => TReturn | Promise<TReturn>): AsyncCollection<TReturn> {
        return new AsyncCollection(this._flatMap(this.clone(), callback))
    }

    flat(): AsyncCollection<NestedValue<T>> {
        return this.flatMap(value => value)
    }

    pipe<TReturn>(callback: (value: T) => TReturn | Promise<TReturn>): AsyncCollection<TReturn> {
		const collection = this.clone()
        return new AsyncCollection(async function* () {
			for await (const value of collection) {
				const result = await callback(value)
				if (result === null) break
				else if(result === undefined) continue
				yield result
			}
		})
    }

	clone() {
		return new AsyncCollection(this.generate)
	}

	[Symbol.asyncIterator](): AsyncIterableIterator<T> {
		return this
	}

}

export default AsyncCollection