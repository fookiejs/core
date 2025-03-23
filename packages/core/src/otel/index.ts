import { context, Span, SpanOptions, SpanStatusCode, trace } from "npm:@opentelemetry/api"

export class DisposableSpan implements Disposable {
	private currentSpan: Span
	private static activeSpanStack: Span[] = []

	static add(name: string, options: SpanOptions = {}): DisposableSpan {
		return new DisposableSpan(name, options)
	}
	constructor(
		private name: string,
		private options: SpanOptions = {},
	) {
		const tracer = trace.getTracer(`@fookie/core`)
		const parentSpan = DisposableSpan.activeSpanStack.length > 0
			? DisposableSpan.activeSpanStack[DisposableSpan.activeSpanStack.length - 1]
			: undefined

		const parentContext = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active()

		this.currentSpan = tracer.startSpan(this.name, this.options, parentContext)

		DisposableSpan.activeSpanStack.push(this.currentSpan)

		this.setupErrorHandling()
	}

	private setupErrorHandling() {
		const _self = this
		const originalOnError = globalThis.onerror
		globalThis.onerror = function () {
			const event = arguments[0] as ErrorEvent
			if (event && event.error) {
				_self.recordException(event.error)
			}
			return originalOnError?.apply(globalThis, arguments as any) ?? false
		}
	}

	public recordException(error: Error): void {
		this.currentSpan.recordException(error)
		this.currentSpan.setStatus({
			code: SpanStatusCode.ERROR,
			message: error.message,
		})
	}

	public addEvent(name: string, attributes: Record<string, any> = {}): void {
		this.currentSpan.addEvent(name, attributes)
	}

	public setAttribute(key: string, value: any): void {
		this.currentSpan.setAttribute(key, value)
	}

	[Symbol.dispose](): void {
		const index = DisposableSpan.activeSpanStack.indexOf(this.currentSpan)
		if (index !== -1) {
			DisposableSpan.activeSpanStack.splice(index, 1)
		}

		this.currentSpan.end()

		globalThis.onerror = null
	}
}
