// A tiny synchronous event bus. The simulation emits facts (shot fired, actor killed, bomb
// planted); audio, effects, the HUD and the bots' ears subscribe. Nothing in sim/ imports a

export function createEvents() {
	const handlers = new Map();
	return {
		on(type, fn) {
			if (!handlers.has(type)) handlers.set(type, []);
			handlers.get(type).push(fn);
		},
		emit(type, payload) {
			const list = handlers.get(type);
			if (!list) return;
			for (let i = 0; i < list.length; i++) list[i](payload);
		},
	};
}
