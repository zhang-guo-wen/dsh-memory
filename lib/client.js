window.__ModuleLoader__.load({
	id: "@zhang-guo-wen/dsh-memory",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region src/typert.ts
		/** Wire namespace and Cordis service key of the memory-store owner. */
		const REMOTE_NAMESPACE = "memoryStore";
		/** Permissive strict codec: accepts any value, returns it unchanged. */
		const passthrough = { parse: (value) => value };
		/**
		* One strict codec over {@link passthrough}.
		*
		* Both schema seats carry the same parse contract: a Host whose Typert registry
		* materializes generated schemas requires the `create()` factory and calls it
		* when a boundary first uses the codec, while an older one calls `schema.parse`.
		* The published `@deepseek-ai/dsh-typert-protocol` release this package
		* dev-depends on declares `schema` alone, so the literal cannot satisfy those
		* types while carrying `create`; drop the assertion once a published protocol
		* version declares `create`.
		* @param typeSymbol - generated-style type symbol naming this codec.
		* @returns the strict codec handed to `ctx.remote.$mount`.
		*/
		function codec(typeSymbol) {
			return {
				mode: "strict",
				typeSymbol,
				schema: passthrough,
				create: () => passthrough
			};
		}
		function descriptor(method) {
			const owner = `@zhang-guo-wen/dsh-memory#${`${REMOTE_NAMESPACE}/${method}`}`;
			return {
				id: owner,
				service: REMOTE_NAMESPACE,
				namespace: REMOTE_NAMESPACE,
				method,
				invocation: { kind: "direct" },
				parameters: [{
					name: "request",
					wire: "request",
					source: "json",
					codec: codec(`${owner}:request`)
				}],
				result: codec(`${owner}:result`)
			};
		}
		/** Contribution mounted by the browser half to reach the memory store. */
		const TYPERT_REMOTE = {
			package: "@zhang-guo-wen/dsh-memory",
			descriptors: [
				descriptor("targets"),
				descriptor("status"),
				descriptor("readIndex"),
				descriptor("writeIndex")
			]
		};
		//#endregion
		//#region \0dsh-css:C:\02-codespace\deepseek-harness\dsh-memory\src\client\MemorySection.module.css.mjs
		const css = ".xqzBuq_section{flex-direction:column;gap:16px;width:100%;max-width:720px;display:flex}.xqzBuq_panel{flex-direction:column;gap:16px;display:flex}.xqzBuq_switchRow{justify-content:space-between;align-items:flex-start;gap:16px;display:flex}.xqzBuq_switchText{flex-direction:column;gap:2px;min-width:0;display:flex}.xqzBuq_switchLabel{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}.xqzBuq_switchDesc{color:var(--dsw-alias-label-secondary);font-size:12px}.xqzBuq_field{flex-direction:column;gap:8px;display:flex}.xqzBuq_fieldLabel{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}.xqzBuq_fieldHint{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;font-size:11.5px;line-height:17px}.xqzBuq_actions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.xqzBuq_input{flex:320px;min-width:220px}.xqzBuq_editor{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);width:100%;min-height:180px;color:var(--dsw-alias-label-primary);resize:vertical;overflow-wrap:anywhere;border-radius:10px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px}.xqzBuq_editor:disabled{color:var(--dsw-alias-label-tertiary)}.xqzBuq_state{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:4px;padding:12px 14px;display:flex}.xqzBuq_stateRow{align-items:baseline;gap:12px;font-size:12px;display:flex}.xqzBuq_stateKey{color:var(--dsw-alias-label-tertiary);flex:0 0 96px}.xqzBuq_stateValue{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.xqzBuq_path{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px}.xqzBuq_browser{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:8px;padding:12px 14px;display:flex}.xqzBuq_browserList{flex-direction:column;gap:2px;max-height:220px;display:flex;overflow-y:auto}.xqzBuq_browserEntry{color:var(--dsw-alias-label-secondary);text-align:left;overflow-wrap:anywhere;cursor:pointer;background:0 0;border:none;border-radius:6px;padding:5px 8px;font-size:12px}.xqzBuq_browserEntry:hover{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}.xqzBuq_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}.xqzBuq_notice{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0;font-size:12px}.xqzBuq_unavailable{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}";
		const tagId = "@zhang-guo-wen/dsh-memory/MemorySection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MemorySection_module_css_default = {
			"actions": "xqzBuq_actions",
			"browser": "xqzBuq_browser",
			"browserEntry": "xqzBuq_browserEntry",
			"browserList": "xqzBuq_browserList",
			"editor": "xqzBuq_editor",
			"field": "xqzBuq_field",
			"fieldHint": "xqzBuq_fieldHint",
			"fieldLabel": "xqzBuq_fieldLabel",
			"hint": "xqzBuq_hint",
			"input": "xqzBuq_input",
			"notice": "xqzBuq_notice",
			"panel": "xqzBuq_panel",
			"path": "xqzBuq_path",
			"section": "xqzBuq_section",
			"state": "xqzBuq_state",
			"stateKey": "xqzBuq_stateKey",
			"stateRow": "xqzBuq_stateRow",
			"stateValue": "xqzBuq_stateValue",
			"switchDesc": "xqzBuq_switchDesc",
			"switchLabel": "xqzBuq_switchLabel",
			"switchRow": "xqzBuq_switchRow",
			"switchText": "xqzBuq_switchText",
			"unavailable": "xqzBuq_unavailable"
		};
		//#endregion
		//#region src/client/MemorySection.tsx
		/**
		* Memory settings section: the directory, its state, and the index editor.
		*
		* The page is the memory plugin's whole operator surface: it turns memory on or
		* off, points the directory at any folder (including a Claude Code `memory/`
		* directory), chooses which project's store the report and the editor describe,
		* and edits the `MEMORY.md` index a session loads.
		*
		* @module @zhang-guo-wen/dsh-memory/client/MemorySection
		*/
		/**
		* CSS-module class lookup for props TypeScript types as strictly `string`:
		* `noUncheckedIndexedAccess` widens every module class to `string | undefined`.
		*/
		const cls = (name) => MemorySection_module_css_default[name] ?? "";
		/** Human-readable byte size for the state rows. */
		function formatSize(bytes) {
			if (bytes < 1024) return `${bytes}B`;
			if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`;
			return `${(bytes / 1048576).toFixed(1)}M`;
		}
		/** One label/value row of the store report. */
		function StateRow({ label, value, title }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MemorySection_module_css_default.stateRow,
				title,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: MemorySection_module_css_default.stateKey,
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: MemorySection_module_css_default.stateValue,
					children: value
				})]
			});
		}
		/** The directory report the Host answered with. */
		function StateBlock({ state, t }) {
			if (state.status.kind === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: MemorySection_module_css_default.hint,
				children: t("status.loading")
			});
			if (state.status.kind === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: MemorySection_module_css_default.notice,
				children: state.status.message
			});
			const report = state.status.value;
			const index = report.index;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MemorySection_module_css_default.state,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("status.resolved"),
						value: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: MemorySection_module_css_default.path,
							children: report.directory
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("status.title"),
						value: report.exists ? t("status.exists") : t("status.missing")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("status.index"),
						value: index === null ? t("status.indexMissing") : t("status.indexSize", {
							lines: index.lines,
							size: formatSize(index.bytes)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("status.files"),
						value: t("status.filesValue", {
							count: report.files.length,
							size: formatSize(report.totalBytes)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateRow, {
						label: t("status.cap"),
						value: formatSize(report.maxFileBytes)
					}),
					index?.truncated === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: MemorySection_module_css_default.notice,
						children: t("status.truncated", {
							lines: index.limitLines,
							bytes: index.limitBytes
						})
					}) : null
				]
			});
		}
		/** The in-app directory browser, shown when the composed picker has no OS chooser. */
		function Browser({ state, t, browse, use, close }) {
			if (state.browser.kind === "closed") return null;
			const cancel = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: MemorySection_module_css_default.actions,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					onClick: close,
					children: t("browser.cancel")
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MemorySection_module_css_default.browser,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MemorySection_module_css_default.fieldLabel,
						children: t("browser.title")
					}),
					state.browser.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: MemorySection_module_css_default.hint,
						children: t("status.loading")
					}) : null,
					state.browser.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: MemorySection_module_css_default.notice,
						children: state.browser.message
					}) : null,
					state.browser.kind === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserListing, {
						listing: state.browser.listing,
						t,
						browse,
						use,
						close
					}) : null,
					state.browser.kind === "loading" || state.browser.kind === "error" ? cancel : null
				]
			});
		}
		/** One browse level: its path, its child directories, and the way back up. */
		function BrowserListing({ listing, t, browse, use, close }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
					className: MemorySection_module_css_default.path,
					children: t("browser.here", { path: listing.path })
				}),
				listing.entries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: MemorySection_module_css_default.hint,
					children: t("browser.empty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: MemorySection_module_css_default.browserList,
					children: listing.entries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MemorySection_module_css_default.browserEntry,
						onClick: () => {
							browse(entry.path);
						},
						children: entry.name
					}, entry.path))
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MemorySection_module_css_default.actions,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: use,
							children: t("browser.use")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								browse(parentOf(listing));
							},
							children: t("browser.parent")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							onClick: close,
							children: t("browser.cancel")
						})
					]
				})
			] });
		}
		/** The listing's parent directory, or the listing itself at the filesystem root. */
		function parentOf(listing) {
			return listing.crumbs.at(-2)?.path ?? listing.path;
		}
		/** The project picker: one menu row per store the Host can show. */
		function TargetPicker({ state, t, select }) {
			const [open, setOpen] = (0, react.useState)(false);
			if (state.targets.length < 2) return null;
			const selected = state.targets.find((target) => target.id === state.target);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MemorySection_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MemorySection_module_css_default.fieldLabel,
						children: t("targets.label")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MemorySection_module_css_default.fieldHint,
						children: t("targets.hint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: MemorySection_module_css_default.actions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								onClick: () => {
									setOpen((value) => !value);
								},
								children: selected?.label ?? t("targets.current")
							}),
							items: state.targets.map((target) => ({
								id: target.id,
								label: target.label
							})),
							selectedId: state.target,
							onSelect: (id) => {
								setOpen(false);
								select(id);
							},
							onClose: () => {
								setOpen(false);
							},
							portal: true
						})
					})
				]
			});
		}
		/** The settings section body. */
		function MemorySection(props) {
			const { useMemory, t } = props;
			const state = useMemory((snapshot) => snapshot);
			const disabled = !state.available || !state.writable;
			const indexDirty = state.index.kind === "ready" && state.index.content !== state.index.saved;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: MemorySection_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MemorySection_module_css_default.panel,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MemorySection_module_css_default.switchRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: MemorySection_module_css_default.switchText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.switchLabel,
									children: t("enable.label")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.switchDesc,
									children: t("enable.desc")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
								checked: state.enabled,
								onChange: (value) => {
									props.setEnabled(value);
								},
								label: t("enable.label"),
								disabled,
								title: disabled ? t("unavailable") : void 0
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MemorySection_module_css_default.switchRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: MemorySection_module_css_default.switchText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.switchLabel,
									children: t("claude.label")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.switchDesc,
									children: t("claude.desc")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
								checked: state.claudeCompatible,
								onChange: (value) => {
									props.setClaudeCompatible(value);
								},
								label: t("claude.label"),
								disabled,
								title: disabled ? t("unavailable") : void 0
							})]
						}),
						state.claudeCompatible ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MemorySection_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.fieldLabel,
									children: t("directory.label")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.fieldHint,
									children: t("directory.hint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: MemorySection_module_css_default.actions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
											className: cls("input"),
											value: state.directory,
											placeholder: t("directory.placeholder"),
											"aria-label": t("directory.label"),
											disabled,
											onChange: (event) => {
												props.editDirectory(event.target.value);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											disabled: disabled || state.directory === state.savedDirectory,
											onClick: () => {
												props.saveDirectory();
											},
											children: t("directory.save")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											disabled,
											onClick: () => {
												props.chooseDirectory();
											},
											children: t("directory.choose")
										})
									]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Browser, {
							state,
							t,
							browse: props.browse,
							use: props.useBrowsed,
							close: props.closeBrowser
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TargetPicker, {
							state,
							t,
							select: props.selectTarget
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateBlock, {
							state,
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MemorySection_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.fieldLabel,
									children: t("index.title")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.fieldHint,
									children: t("index.hint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: MemorySection_module_css_default.editor,
									value: state.index.kind === "ready" ? state.index.content : "",
									placeholder: t("index.placeholder"),
									"aria-label": t("index.title"),
									disabled: disabled || state.index.kind !== "ready",
									spellCheck: false,
									onChange: (event) => {
										props.editIndex(event.target.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: MemorySection_module_css_default.actions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										disabled: disabled || !indexDirty,
										onClick: () => {
											props.saveIndex();
										},
										children: t("index.save")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										disabled,
										onClick: () => {
											props.refresh();
										},
										children: t("index.reload")
									})]
								})
							]
						}),
						state.notice !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: MemorySection_module_css_default.notice,
							children: state.notice
						}) : null,
						disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: MemorySection_module_css_default.unavailable,
							children: t("unavailable")
						}) : null
					]
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Memory settings section dictionaries.
		*
		* The page states the memory directory, what the Host does with it, and the
		* index the next session loads, so an operator can point memory at an existing
		* Claude Code `memory/` directory without reading the README. Each key of the
		* Chinese dictionary is part of {@link MemorySectionKey}, and `en` is typed
		* against it, so a new entry cannot ship untranslated.
		*
		* @module @zhang-guo-wen/dsh-memory/client/locales
		*/
		/** Locale namespace owned by this plugin. */
		const NS = "settings.memory";
		const zh = {
			"nav": "记忆",
			"enable.label": "启用记忆",
			"enable.desc": "把索引注入每个新会话，并注册 memory 工具",
			"claude.label": "兼容 Claude 目录",
			"claude.desc": "直接读写 Claude Code 的 ~/.claude/projects/<项目>/memory，与 Claude 共用同一份记忆；开启后不用选目录",
			"directory.label": "记忆目录模板",
			"directory.hint": "这里填的是模板：{project} 替换成当前项目的目录名（按 Claude 的 projects 命名规则，同一仓库的 worktree 共用同一个），~ 表示用户目录；去掉 {project} 就是所有项目共用一份。",
			"directory.placeholder": "~/.dsh/memory/{project}",
			"directory.save": "保存",
			"directory.choose": "选择目录…",
			"directory.unsaved": "有未保存的修改",
			"status.title": "目录状态",
			"status.resolved": "实际使用目录",
			"status.loading": "读取中…",
			"status.missing": "目录不存在，第一次写入时创建",
			"status.exists": "目录已存在",
			"status.files": "文件",
			"status.filesValue": "{count} 个 · 合计 {size}",
			"status.index": "索引",
			"status.indexMissing": "还没有 MEMORY.md",
			"status.indexSize": "{lines} 行 · {size}",
			"status.truncated": "超出会话加载上限（{lines} 行 / {bytes} 字节），只注入前一部分",
			"status.cap": "单文件上限",
			"index.title": "MEMORY.md 索引",
			"index.hint": "索引只放指针：一行一个记忆，格式 - [标题](文件.md) — 一句话说明。记忆正文写在各自的话题文件里。",
			"index.placeholder": "- [调试记录](debugging.md) — 认证令牌轮换与数据库连接排查",
			"index.save": "保存索引",
			"index.reload": "重新载入",
			"targets.label": "项目",
			"targets.hint": "状态与索引针对哪个项目：列表来自 DSH 工作区；打开「兼容 Claude 目录」后还会列出 Claude 的项目目录。",
			"targets.current": "当前项目",
			"browser.title": "选择记忆目录",
			"browser.here": "当前：{path}",
			"browser.parent": "上一级",
			"browser.use": "用这个目录",
			"browser.cancel": "取消",
			"browser.empty": "没有子目录",
			"unavailable": "设置当前不可用",
			"refreshing": "刷新中…",
			"notice.directorySaved": "目录已保存"
		};
		const en = {
			"nav": "Memory",
			"enable.label": "Enable memory",
			"enable.desc": "Fold the index into every new session and register the memory tool",
			"claude.label": "Use Claude's directory",
			"claude.desc": "Read and write Claude Code's own ~/.claude/projects/<project>/memory, sharing those memories with Claude; no directory to choose while it is on",
			"directory.label": "Memory directory template",
			"directory.hint": "This is a template: {project} is replaced by the current project's directory name (named the way Claude names its projects; worktrees of one repository share it) and ~ is the user home; drop {project} to share one store across projects.",
			"directory.placeholder": "~/.dsh/memory/{project}",
			"directory.save": "Save",
			"directory.choose": "Choose directory…",
			"directory.unsaved": "Unsaved change",
			"status.title": "Directory state",
			"status.resolved": "Resolved for this project",
			"status.loading": "Reading…",
			"status.missing": "The directory does not exist yet; the first write creates it",
			"status.exists": "The directory exists",
			"status.files": "Files",
			"status.filesValue": "{count} · {size} total",
			"status.index": "Index",
			"status.indexMissing": "No MEMORY.md yet",
			"status.indexSize": "{lines} lines · {size}",
			"status.truncated": "Over the session load limit ({lines} lines / {bytes} bytes); only the leading part is injected",
			"status.cap": "File cap",
			"index.title": "MEMORY.md index",
			"index.hint": "The index holds pointers only: one line per memory, formatted - [Title](file.md) — one-line hook. Memory content lives in its own topic file.",
			"index.placeholder": "- [Debugging notes](debugging.md) — auth token rotation and database connection troubleshooting",
			"index.save": "Save index",
			"index.reload": "Reload",
			"targets.label": "Project",
			"targets.hint": "Which project the state and the index describe: the list comes from DSH workspaces, plus Claude's project directories while Claude-directory mode is on.",
			"targets.current": "Current project",
			"browser.title": "Choose the memory directory",
			"browser.here": "Current: {path}",
			"browser.parent": "Up",
			"browser.use": "Use this directory",
			"browser.cancel": "Cancel",
			"browser.empty": "No subdirectories",
			"unavailable": "Settings are unavailable",
			"refreshing": "Refreshing…",
			"notice.directorySaved": "Directory saved"
		};
		//#endregion
		//#region src/client/settings-controller.ts
		/**
		* Controller bridging the Host `memory` settings namespace and the
		* `memoryStore` Remote onto the settings section snapshot.
		*
		* The section owns one draft per writable value (the directory field and the
		* index editor) and one host report; every action commits through the settings
		* scope or the Remote and then republishes, so what the page shows is what the
		* Host holds.
		*
		* @module @zhang-guo-wen/dsh-memory/client/settings-controller
		*/
		/** Settings namespace registered Host-side by @zhang-guo-wen/dsh-memory. */
		const MEMORY_SETTINGS_NS = "memory";
		/** Owner handle over the namespace, the Remote, and the section snapshot. */
		var MemorySectionController = class {
			scope;
			host;
			store;
			unsubscribe;
			status = { kind: "loading" };
			index = { kind: "loading" };
			browser = { kind: "closed" };
			directory = "";
			savedDirectory = "";
			enabled = true;
			claudeCompatible = false;
			targets = [];
			target = "current";
			notice = null;
			/**
			* @param scope - bound `memory` settings scope.
			* @param host - the Remote calls the section drives.
			*/
			constructor(scope, host) {
				this.scope = scope;
				this.host = host;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.projection());
				this.unsubscribe = scope.subscribe(() => {
					this.readFlags();
					this.publish();
					this.refresh();
				});
				this.readFlags();
				this.publish();
			}
			/** Start the section: read the flags, the Host report, and the index. */
			start() {
				this.refresh();
			}
			/** Stop observing settings. */
			dispose() {
				this.unsubscribe();
			}
			/** Build the renderer face for this section. */
			inject() {
				return {
					hooks: { memory: this.store },
					setEnabled: (value) => {
						this.setEnabled(value);
					},
					setClaudeCompatible: (value) => {
						this.setClaudeCompatible(value);
					},
					editDirectory: (value) => {
						this.directory = value;
						this.publish();
					},
					saveDirectory: () => {
						this.saveDirectory();
					},
					refresh: () => {
						this.refresh();
					},
					selectTarget: (id) => {
						this.selectTarget(id);
					},
					editIndex: (value) => {
						this.editIndex(value);
					},
					saveIndex: () => {
						this.saveIndex();
					},
					chooseDirectory: () => {
						this.chooseDirectory();
					},
					browse: (path) => {
						this.browse(path);
					},
					closeBrowser: () => {
						this.browser = { kind: "closed" };
						this.publish();
					},
					useBrowsed: () => {
						this.useBrowsed();
					}
				};
			}
			readFlags() {
				const value = this.scope.getSnapshot().value;
				this.enabled = value?.enabled ?? true;
				this.claudeCompatible = value?.claudeCompatible ?? false;
				const directory = value?.directory ?? "";
				this.directory = directory;
				this.savedDirectory = directory;
			}
			projection() {
				const snapshot = this.scope.getSnapshot();
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					enabled: this.enabled,
					claudeCompatible: this.claudeCompatible,
					directory: this.directory,
					savedDirectory: this.savedDirectory,
					status: this.status,
					index: this.index,
					browser: this.browser,
					targets: this.targets,
					target: this.target,
					notice: this.notice
				};
			}
			publish() {
				this.store.set(this.projection());
			}
			setEnabled(value) {
				if (!this.canWrite()) return;
				this.enabled = value;
				this.publish();
				this.commit("enabled", value);
			}
			setClaudeCompatible(value) {
				if (!this.canWrite()) return;
				this.claudeCompatible = value;
				this.browser = { kind: "closed" };
				this.publish();
				this.commit("claudeCompatible", value);
			}
			/**
			* Show another project's store.
			*
			* A project the Host no longer offers — a workspace removed between two
			* refreshes — falls back to the Host's own answer (`status.target`), which is
			* where an unknown id lands anyway.
			*/
			selectTarget(id) {
				this.target = id;
				this.index = { kind: "loading" };
				this.publish();
				this.refresh();
			}
			/**
			* Commit one settings field and re-read the Host's answer.
			*
			* A Host that does not know the field — an older plugin build still loaded in
			* the process — leaves the document unchanged, so the switch must snap back to
			* what the Host actually holds instead of showing a write that never took.
			*/
			async commit(field, value) {
				await this.run(async () => {
					await this.scope.set(field, value);
				});
				this.readFlags();
				this.publish();
			}
			saveDirectory() {
				if (!this.canWrite()) return;
				const directory = this.directory.trim();
				this.savedDirectory = directory;
				this.notice = null;
				this.publish();
				this.commit("directory", directory);
			}
			editIndex(content) {
				if (this.index.kind !== "ready") return;
				this.index = {
					...this.index,
					content
				};
				this.publish();
			}
			saveIndex() {
				if (this.index.kind !== "ready" || !this.canWrite()) return;
				const content = this.index.content;
				this.run(async () => {
					await this.host.writeIndex(this.target, content);
					this.notice = null;
					await this.loadIndex();
				});
			}
			chooseDirectory() {
				this.run(async () => {
					const picked = await this.host.pick();
					if (picked.ok) {
						if (picked.value !== null) {
							this.directory = picked.value;
							this.saveDirectory();
						}
						return;
					}
					if (!picked.unavailable) throw new Error(picked.message);
					await this.loadBrowser(void 0);
				});
			}
			browse(path) {
				this.run(async () => {
					await this.loadBrowser(path);
				});
			}
			useBrowsed() {
				if (this.browser.kind !== "ready") return;
				this.directory = this.browser.listing.path;
				this.browser = { kind: "closed" };
				this.saveDirectory();
			}
			refresh() {
				this.run(async () => {
					this.targets = await this.loadTargets();
					this.status = await this.loadStatus();
					await this.loadIndex();
				});
			}
			async loadTargets() {
				try {
					const targets = await this.host.targets();
					return targets.length > 0 ? targets : this.targets;
				} catch {
					return this.targets;
				}
			}
			async loadStatus() {
				try {
					const value = await this.host.status(this.target);
					this.target = value.target;
					return {
						kind: "ready",
						value
					};
				} catch (error) {
					return {
						kind: "error",
						message: messageOf(error)
					};
				}
			}
			async loadIndex() {
				try {
					const index = await this.host.readIndex(this.target);
					this.index = {
						kind: "ready",
						exists: index.exists,
						content: index.content,
						saved: index.content
					};
				} catch (error) {
					this.index = {
						kind: "error",
						message: messageOf(error)
					};
				}
			}
			async loadBrowser(path) {
				this.browser = { kind: "loading" };
				this.publish();
				try {
					this.browser = {
						kind: "ready",
						listing: await this.host.list(path)
					};
				} catch (error) {
					this.browser = {
						kind: "error",
						message: messageOf(error)
					};
				}
			}
			/** Run one action with the section's busy state and error notice around it. */
			async run(action) {
				this.notice = null;
				this.publish();
				try {
					await action();
				} catch (error) {
					this.notice = messageOf(error);
				}
				this.publish();
			}
			canWrite() {
				return this.scope.getSnapshot().writable;
			}
		};
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services (cordis fiber inject). The directory picker is optional. */
		const inject = [
			"slots",
			"locale",
			"settingsScope",
			"remote"
		];
		/** Unwrap a Typert `RemoteResult` or surface the Host failure. */
		async function unwrapRemote(call) {
			const result = await call();
			if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
			return result.value;
		}
		/**
		* Register the dictionaries, the Remote mount, and the memory settings section.
		* @param ctx - client root context.
		*/
		async function apply(ctx) {
			const disposeMount = await ctx.remote.$mount(TYPERT_REMOTE);
			ctx.effect(() => () => disposeMount(), "dsh-memory: remote mount");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-memory: dictionaries");
			const t = ctx.locale.bind(NS);
			const namespace = () => {
				const mounted = ctx.get(`remote.${REMOTE_NAMESPACE}`);
				if (mounted === void 0) throw new Error(`${REMOTE_NAMESPACE} namespace service is not mounted`);
				return mounted;
			};
			const picker = () => ctx.get("remote.directoryPicker");
			const controller = new MemorySectionController(ctx.settingsScope.bind({ namespace: MEMORY_SETTINGS_NS }), {
				targets: async () => (await unwrapRemote(() => namespace().targets({}))).targets,
				status: async (target) => await unwrapRemote(() => namespace().status({ target })),
				readIndex: async (target) => {
					const result = await unwrapRemote(() => namespace().readIndex({ target }));
					return {
						exists: result.exists,
						content: result.content
					};
				},
				writeIndex: async (target, content) => {
					await unwrapRemote(() => namespace().writeIndex({
						target,
						content
					}));
				},
				pick: async () => {
					const composed = picker();
					if (composed === void 0) return {
						ok: false,
						unavailable: false,
						message: "no directory picker is composed in this host"
					};
					const result = await composed.pick();
					if (result.ok) return {
						ok: true,
						value: result.value
					};
					return {
						ok: false,
						unavailable: result.error.code === "directory-picker/unavailable",
						message: `${result.error.code}: ${result.error.message}`
					};
				},
				list: async (path) => {
					const composed = picker();
					if (composed === void 0) throw new Error("no directory picker is composed in this host");
					return await unwrapRemote(() => composed.list(path));
				}
			});
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-memory: scope");
			controller.start();
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "memory",
				order: 15,
				label: () => t("nav"),
				locale: NS,
				inject: () => controller.inject()
			}, MemorySection));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
