const VOID_TAGS = [
	// List from: https://riptutorial.com/html/example/4736/void-elements
	'area',
	'base',
	'br',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'command',
	'keygen',
	'source'
];


/**
 * This is an interruptable ~html parser.  Its purpose is to extract information about the resulting DOM from HTML template literals.
 * Using it, we can get references to individual elements by tracing the "decendent path" or child indexes from the root of the template
 * to the element that we care about.  Doing it this way doesn't require a full dom traversal for a search or any ids / classes.
 */
export default class Parser {
	// TODO: Use private members when they become supported.
	_unparsed = ""
	stack = []
	_match = false
	_html = "";
	_state = this._parser()

	advance(str) {
		this._unparsed += str;
		this._html += str;
		this._state.next();
		console.assert(this._unparsed.trim() == "", "There shouldn't be unparsed text after an advance.  This might indicate a break in an invalid location.");
	}
	finish() {
		this._state.return();
		const template = document.createElement('template');
		template.innerHTML = this._html;
		return template;
	}
	get_descendant_path() {
		let body = 'return root';
		for (const frame of this.stack) {
			if (frame.child_index === undefined) {
				throw new Error("Frame in the stack without a child_index.  This likely indicates being in the middle of an attribute-value.  Try moving the expression outside the attribute's value position and into attribute position.");
			}
			body += '.childNodes[';
			body += frame.child_index.toString();
			body += ']';
		}
		body += ';';
		return new Function('root', body);
	}

	// TODO: Rename as private when that's available.
	_pull(regex) {
		const res = regex.exec(this._unparsed);
		if (res !== null) {
			const [full_match, ...captures] = res;
			this._unparsed = this._unparsed.substr(full_match.length);
			this._match = captures;
			return true;
		} else {
			this._match = false;
			return false;
		}
	}
	top() {
		return this.stack[this.stack.length - 1];
	}
	*_parse_attributes () {
		let any_consumed = false;
		while (true) {
			// Pull an attribute name
			if (this._pull(/^\s+([a-zA-Z][a-zA-Z0-9\-]*)/)) {
				any_consumed = true;
				const attribute = {
					attribute_name: this._match[0],
					value: ""
				};
				this.stack.push(attribute);
				// Try to parse an attribute value
				if (this._pull(/^="/)) {
					while (!this._pull(/^"/)) {
						if (this._pull(/^([^"]+)/)) {
							attribute.value += this._match[0];
						} else {
							yield;
						}
					}
				}
				const popped = this.stack.pop();
				console.assert(popped === attribute, popped, attribute);
			} else {
				break;
			}	
		}
		return any_consumed;
	}

	*_parse_comment() {
		if (this._pull(/^<!--/)) {
			const prev_content = this.stack.pop();
			const comment = {
				comment_content: "",
				child_index: prev_content.content == "" ? prev_content.child_index : prev_content.child_index + 1
			};
			this.stack.push(comment);
			while (true) {
				// Pull as much text as we can
				if (this._pull(/^((?:[^-]|-(?!->))+)/)) {
					comment.comment_content += this._match[0];
				}
				// Try to pull a comment closing
				else if (this._pull(/^-->/)) {
					const popped = this.stack.pop();
					console.assert(comment === popped, comment, popped);
					this.stack.push({
						content: "",
						child_index: comment.child_index + 1
					});
					return true;
				}
				// Pause if we did neither:
				else {
					yield;
				}
			}
		} else {
			return false;
		}
	}

	*_parser() {
		this.stack.push({
			content: "",
			child_index: 0
		});
		try {
			while (true) {
				if (!(yield* this._parse_content())) {
					yield;
				}
			}
		} finally {
			if (this._unparsed.length > 0) {
				throw new Error("Parsing Error: Unused input");
			}
			if (this.stack.pop().content === undefined) {
				throw new Error("Parsing Error: Stack problem");
			}
		}
	}
	*_parse_content() {
		let any_consumed = false;
		while(true) {
			const top = this.top();
			// Open Tag
			if (this._pull(/^\<([a-zA-Z][\-a-zA-Z0-9]*)/)) {
				any_consumed = true;
				const tag_name = this._match[0];
				// Pop the content frame
				this.stack.pop();
				// Add a new tag frame
				const new_tag = {
					tag_name,
					child_index: (top.content === "") ?
						top.child_index :
						top.child_index + 1
				};
				this.stack.push(new_tag);
				// Parse any attributes until the end of the openning tag
				while (!this._pull(/^\s*\>/)) {
					if (!(yield* this._parse_attributes())) {
						yield;
					}
				}
				if (!VOID_TAGS.includes(tag_name)) {
					this.stack.push({
						content: "",
						child_index: 0
					});
					// If we're not a void tag then parse content until we get a close tag
					while (!this._pull(/^\<\/([a-zA-Z][a-zA-Z0-9\-]*)\>/)) {
						if (!(yield* this._parse_content())) {
							yield;
						}
					}
					if (this._match[0] !== tag_name) {
						throw new Error("Wrong closing tag: ", this._match[0], " !== ", tag_name);
					}
					const popped = this.stack.pop();
					console.assert(popped.content !== undefined, "Popped non content frame.");
				}
				// Pop the tag off the stack
				const popped = this.stack.pop();
				console.assert(new_tag === popped, new_tag, popped);
				this.stack.push({
					content: "",
					child_index: new_tag.child_index + 1
				});
			}
			// Comment Node
			else if (yield* this._parse_comment()) {
				any_consumed = true;
			}
			// Normal Text content
			else if (this._pull(/^([^\<]+)/)) {
				any_consumed = true;
				top.content += this._match[0];
			}
			// Nothing matched
			else {
				return any_consumed;
			}
		}
	}
}