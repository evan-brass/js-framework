import apply_expression from "./apply-expression.mjs";

export function make_mount(apply_expr = apply_expression) {
	return function mount(expression, root = document.body) {
		const controller = new AbortController();

		const temp = new Comment();
		root.appendChild(temp);

		apply_expr(expression, temp, controller.signal);

		// TODO: Cleanup the comment node that get's left behind when the expression cleans itself up.

		return () => controller.abort();
	};
}

export default make_mount();