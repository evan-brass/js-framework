import User from './user.mjs';

export default function resizeObserve(observer) {
	return {
		acceptTypes: ["attribute"],
		bind(part) {
			observer.observe(part.element);
		},
		unbind(part) {
			observer.unobserve(part.element);
		},
		get [User]() { return this; }
	}
}