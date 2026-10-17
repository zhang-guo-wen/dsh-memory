window.__ModuleLoader__.load({
	id: "@guowenzhang/dsh-memory",
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
			const owner = `@guowenzhang/dsh-memory#${`${REMOTE_NAMESPACE}/${method}`}`;
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
			package: "@guowenzhang/dsh-memory",
			descriptors: [
				descriptor("targets"),
				descriptor("status"),
				descriptor("readIndex"),
				descriptor("writeIndex")
			]
		};
		//#endregion
		//#region \0dsh-css:C:\Users\Windows11\AppData\Local\Temp\dsh-I0sgSn\dsh-release-20261017\work\dsh-memory\src\client\MemorySection.module.css.mjs
		const css = ".VIBSla_section{flex-direction:column;gap:16px;width:100%;max-width:720px;display:flex;container:VIBSla_memory-section/inline-size}.VIBSla_panel{flex-direction:column;gap:16px;display:flex}.VIBSla_switchRow{justify-content:space-between;align-items:flex-start;gap:16px;display:flex}.VIBSla_switchText{flex-direction:column;gap:2px;min-width:0;display:flex}.VIBSla_switchLabel{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-primary);font-weight:600}.VIBSla_switchDesc{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary)}.VIBSla_field{flex-direction:column;gap:8px;display:flex}.VIBSla_fieldLabel{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-primary);font-weight:600}.VIBSla_fieldHint{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}.VIBSla_unsaved{color:var(--dsw-alias-state-warn-label)}.VIBSla_actions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.VIBSla_input{flex:320px;min-width:220px}.VIBSla_editor{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-base);width:100%;min-height:180px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);font-family:var(--ds-font-family-code);resize:vertical;overflow-wrap:anywhere;padding:10px 12px}.VIBSla_editor:disabled{color:var(--dsw-alias-label-tertiary)}.VIBSla_state{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);flex-direction:column;gap:4px;padding:12px 14px;display:flex}.VIBSla_stateRow{font:var(--dsw-font-xxs-12);align-items:baseline;gap:12px;display:flex}.VIBSla_stateKey{color:var(--dsw-alias-label-tertiary);flex:0 0 96px}.VIBSla_stateValue{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.VIBSla_path{font:var(--dsw-font-xxs-12);font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.VIBSla_browser{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);flex-direction:column;gap:8px;padding:12px 14px;display:flex}.VIBSla_browserList{flex-direction:column;gap:2px;max-height:220px;display:flex;overflow-y:auto}.VIBSla_browserEntry{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);text-align:left;overflow-wrap:anywhere;cursor:pointer;background:0 0;border:none;padding:5px 8px}.VIBSla_browserEntry:hover{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}.VIBSla_hint{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);margin:0}.VIBSla_noticeRow{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 12px;display:flex}.VIBSla_notice{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0}.VIBSla_notice[data-tone=success]{color:var(--dsw-alias-state-success-primary)}.VIBSla_notice[data-tone=error]{color:var(--dsw-alias-state-error-primary)}.VIBSla_errorReason{color:var(--dsw-alias-label-tertiary)}.VIBSla_errorRow{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 12px;padding:12px 14px;display:flex}.VIBSla_errorRow p{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;margin:0}.VIBSla_skeleton{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);flex-direction:column;gap:4px;padding:12px 14px;display:flex}.VIBSla_skeletonRow{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-skeleton);height:18px;display:block}.VIBSla_skeletonEditor{box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-skeleton);width:100%;min-height:180px;display:block}.VIBSla_unavailable{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin:0}@container VIBSla_memory-section (width<=420px){.VIBSla_stateRow{flex-direction:column;align-items:flex-start;gap:2px}.VIBSla_stateKey{flex:none}.VIBSla_noticeRow,.VIBSla_errorRow{align-items:flex-start}}@media (pointer:coarse){.VIBSla_switchRow{cursor:pointer;min-height:44px}.VIBSla_actions>*,.VIBSla_browserEntry,.VIBSla_input{min-height:44px}.VIBSla_input input,.VIBSla_editor{font-size:16px;line-height:24px}}";
		const tagId = "@guowenzhang/dsh-memory/MemorySection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MemorySection_module_css_default = {
			"actions": "VIBSla_actions",
			"browser": "VIBSla_browser",
			"browserEntry": "VIBSla_browserEntry",
			"browserList": "VIBSla_browserList",
			"editor": "VIBSla_editor",
			"errorReason": "VIBSla_errorReason",
			"errorRow": "VIBSla_errorRow",
			"field": "VIBSla_field",
			"fieldHint": "VIBSla_fieldHint",
			"fieldLabel": "VIBSla_fieldLabel",
			"hint": "VIBSla_hint",
			"input": "VIBSla_input",
			"memory-section": "VIBSla_memory-section",
			"notice": "VIBSla_notice",
			"noticeRow": "VIBSla_noticeRow",
			"panel": "VIBSla_panel",
			"path": "VIBSla_path",
			"section": "VIBSla_section",
			"skeleton": "VIBSla_skeleton",
			"skeletonEditor": "VIBSla_skeletonEditor",
			"skeletonRow": "VIBSla_skeletonRow",
			"state": "VIBSla_state",
			"stateKey": "VIBSla_stateKey",
			"stateRow": "VIBSla_stateRow",
			"stateValue": "VIBSla_stateValue",
			"switchDesc": "VIBSla_switchDesc",
			"switchLabel": "VIBSla_switchLabel",
			"switchRow": "VIBSla_switchRow",
			"switchText": "VIBSla_switchText",
			"unavailable": "VIBSla_unavailable",
			"unsaved": "VIBSla_unsaved"
		};
		//#endregion
		//#region src/client/MemorySection.tsx
		/**
		* Memory settings section: the directory, its state, and the index editor.
		*
		* The page is the memory plugin's whole operator surface: it turns memory on or
		* off, points the directory at any folder (including a Claude Code `memory/`
		* directory), chooses which project's store the report and the editor describe,
		* and edits the `MEMORY.md` index a session loads. Every write reports which
		* action is running and how the last one ended, so a slow Host is visible and a
		* failure keeps both the data and a way to run the action again.
		*
		* @module @guowenzhang/dsh-memory/client/MemorySection
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
		/**
		* One switch with its copy: the row is a press area in its own right, because
		* the host's control is 36x20 and a finger misses it on a phone. A press that
		* lands on a control keeps that control's own behaviour.
		*/
		function SwitchRow({ label, desc, checked, disabled, title, onChange }) {
			const press = (event) => {
				if (event.target instanceof HTMLElement && event.target.closest("button, input, select, textarea, a") !== null) return;
				if (!disabled) onChange(!checked);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MemorySection_module_css_default.switchRow,
				onClick: press,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: MemorySection_module_css_default.switchText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MemorySection_module_css_default.switchLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: MemorySection_module_css_default.switchDesc,
						children: desc
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
					checked,
					onChange,
					label,
					disabled,
					title
				})]
			});
		}
		/** First read of the report, in the place its rows will occupy. */
		function StateSkeleton({ t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: MemorySection_module_css_default.skeleton,
				role: "status",
				"aria-busy": "true",
				"aria-label": t("status.loading"),
				children: [
					0,
					1,
					2,
					3
				].map((index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: MemorySection_module_css_default.skeletonRow,
					"aria-hidden": "true"
				}, index))
			});
		}
		/** The directory report the Host answered with. */
		function StateBlock({ state, t, retry }) {
			if (state.status.kind === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateSkeleton, { t });
			if (state.status.kind === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MemorySection_module_css_default.errorRow,
				role: "alert",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [t("status.error"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: MemorySection_module_css_default.errorReason,
					children: ` · ${state.status.message}`
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: state.busy !== "",
					onClick: retry,
					children: t("retry")
				})]
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
					state.browser.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: MemorySection_module_css_default.skeleton,
						role: "status",
						"aria-busy": "true",
						"aria-label": t("status.loading"),
						children: [
							0,
							1,
							2
						].map((index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MemorySection_module_css_default.skeletonRow,
							"aria-hidden": "true"
						}, index))
					}) : null,
					state.browser.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: MemorySection_module_css_default.notice,
						role: "alert",
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
								disabled: state.busy !== "",
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
			const idle = disabled || state.busy !== "";
			const indexDirty = state.index.kind === "ready" && state.index.content !== state.index.saved;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: MemorySection_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MemorySection_module_css_default.panel,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchRow, {
							label: t("enable.label"),
							desc: t("enable.desc"),
							checked: state.enabled,
							disabled: idle,
							title: disabled ? t("unavailable") : void 0,
							onChange: (value) => {
								props.setEnabled(value);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SwitchRow, {
							label: t("claude.label"),
							desc: t("claude.desc"),
							checked: state.claudeCompatible,
							disabled: idle,
							title: disabled ? t("unavailable") : void 0,
							onChange: (value) => {
								props.setClaudeCompatible(value);
							}
						}),
						state.claudeCompatible ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MemorySection_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.fieldLabel,
									children: t("directory.label")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: MemorySection_module_css_default.fieldHint,
									children: [t("directory.hint"), state.directory !== state.savedDirectory ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: MemorySection_module_css_default.unsaved,
										children: ` · ${t("directory.unsaved")}`
									}) : null]
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
											disabled: idle || state.directory === state.savedDirectory,
											onClick: () => {
												props.saveDirectory();
											},
											children: t(state.busy === "directory" ? "saving" : "directory.save")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											disabled: idle,
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
							t,
							retry: () => {
								props.refresh();
							}
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
								state.index.kind === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.skeletonEditor,
									role: "status",
									"aria-busy": "true",
									"aria-label": t("status.loading")
								}) : null,
								state.index.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: MemorySection_module_css_default.errorRow,
									role: "alert",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [t("index.loadFailed"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: MemorySection_module_css_default.errorReason,
										children: ` · ${state.index.message}`
									})] })
								}) : null,
								state.index.kind === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: MemorySection_module_css_default.editor,
									value: state.index.content,
									placeholder: t("index.placeholder"),
									"aria-label": t("index.title"),
									disabled,
									spellCheck: false,
									onChange: (event) => {
										props.editIndex(event.target.value);
									}
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: MemorySection_module_css_default.actions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										disabled: idle || !indexDirty,
										onClick: () => {
											props.saveIndex();
										},
										children: t(state.busy === "index" ? "saving" : "index.save")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										disabled: idle,
										onClick: () => {
											props.reloadIndex();
										},
										children: t(state.busy === "reload" ? "refreshing" : "index.reload")
									})]
								})
							]
						}),
						state.notice !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MemorySection_module_css_default.noticeRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: MemorySection_module_css_default.notice,
								"data-tone": state.notice.tone,
								role: state.notice.tone === "error" ? "alert" : "status",
								children: [state.notice.tone === "success" ? t(state.notice.key) : t("error.action"), state.notice.tone === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: MemorySection_module_css_default.errorReason,
									children: ` · ${state.notice.message}`
								}) : null]
							}), state.notice.tone === "error" && state.notice.retry !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								disabled: idle,
								onClick: () => {
									props.retryNotice();
								},
								children: t("retry")
							}) : null]
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
		* @module @guowenzhang/dsh-memory/client/locales
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
			"status.error": "无法读取目录状态",
			"status.resolved": "实际使用目录",
			"status.loading": "读取中…",
			"status.missing": "目录不存在，第一次写入时创建",
			"status.exists": "目录已存在",
			"status.files": "文件",
			"status.filesValue": "{count} 个 · 合计 {size}",
			"status.index": "索引",
			"status.indexMissing": "还没有 MEMORY.md，保存一次索引即创建",
			"status.indexSize": "{lines} 行 · {size}",
			"status.truncated": "超出会话加载上限（{lines} 行 / {bytes} 字节），只注入前一部分",
			"status.cap": "单文件上限",
			"index.title": "MEMORY.md 索引",
			"index.hint": "索引只放指针：一行一个记忆，格式 - [标题](文件.md) — 一句话说明。记忆正文写在各自的话题文件里。",
			"index.placeholder": "- [调试记录](debugging.md) — 认证令牌轮换与数据库连接排查",
			"index.save": "保存索引",
			"index.reload": "重新载入",
			"index.loadFailed": "无法读取索引文件",
			"targets.label": "项目",
			"targets.hint": "状态与索引针对哪个项目：列表来自 DSH 工作区；打开「兼容 Claude 目录」后还会列出 Claude 的项目目录。",
			"targets.current": "当前项目",
			"browser.title": "选择记忆目录",
			"browser.here": "当前：{path}",
			"browser.parent": "上一级",
			"browser.use": "用这个目录",
			"browser.cancel": "取消",
			"browser.empty": "没有子目录；可以点「上一级」，或直接用当前目录",
			"unavailable": "设置当前不可用",
			"retry": "重试",
			"saving": "保存中…",
			"refreshing": "刷新中…",
			"error.action": "操作失败",
			"notice.directorySaved": "目录已保存",
			"notice.indexSaved": "索引已保存"
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
			"status.error": "Could not read the directory state",
			"status.resolved": "Resolved for this project",
			"status.loading": "Reading…",
			"status.missing": "The directory does not exist yet; the first write creates it",
			"status.exists": "The directory exists",
			"status.files": "Files",
			"status.filesValue": "{count} · {size} total",
			"status.index": "Index",
			"status.indexMissing": "No MEMORY.md yet; saving the index once creates it",
			"status.indexSize": "{lines} lines · {size}",
			"status.truncated": "Over the session load limit ({lines} lines / {bytes} bytes); only the leading part is injected",
			"status.cap": "File cap",
			"index.title": "MEMORY.md index",
			"index.hint": "The index holds pointers only: one line per memory, formatted - [Title](file.md) — one-line hook. Memory content lives in its own topic file.",
			"index.placeholder": "- [Debugging notes](debugging.md) — auth token rotation and database connection troubleshooting",
			"index.save": "Save index",
			"index.reload": "Reload",
			"index.loadFailed": "Could not read the index file",
			"targets.label": "Project",
			"targets.hint": "Which project the state and the index describe: the list comes from DSH workspaces, plus Claude's project directories while Claude-directory mode is on.",
			"targets.current": "Current project",
			"browser.title": "Choose the memory directory",
			"browser.here": "Current: {path}",
			"browser.parent": "Up",
			"browser.use": "Use this directory",
			"browser.cancel": "Cancel",
			"browser.empty": "No subdirectories; go up a level, or use the current directory",
			"unavailable": "Settings are unavailable",
			"retry": "Retry",
			"saving": "Saving…",
			"refreshing": "Refreshing…",
			"error.action": "The action failed",
			"notice.directorySaved": "Directory saved",
			"notice.indexSaved": "Index saved"
		};
		//#endregion
		//#region src/client/settings-controller.ts
		/**
		* Controller bridging the Host `memory` settings namespace and the
		* `memoryStore` Remote onto the settings section snapshot.
		*
		* The section owns one draft per writable value (the directory field and the
		* index editor) and one host report; every action commits through the
		* configuration form or the Remote and then republishes, so what the page shows
		* is what the Host holds. Every action also publishes which write is running
		* and how the last one ended, so the page can show a running, a succeeded, and
		* a failed state per action without a second source of truth.
		*
		* @module @guowenzhang/dsh-memory/client/settings-controller
		*/
		/** Settings namespace registered Host-side by @guowenzhang/dsh-memory. */
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
			busy = "";
			notice = null;
			/** The switch write a failure notice can send again, and what it should write. */
			failedSwitch = null;
			/**
			* @param scope - the `memory` configuration form.
			* @param host - the Remote calls the section drives.
			*/
			constructor(scope, host) {
				this.scope = scope;
				this.host = host;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.projection());
				this.unsubscribe = scope.subscribe(() => {
					this.readFlags();
					this.publish();
					this.load();
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
					reloadIndex: () => {
						this.reloadIndex();
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
					},
					retryNotice: () => {
						this.retryNotice();
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
					busy: this.busy,
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
				this.run("target", () => this.load(), "refresh");
			}
			/**
			* Commit one settings field and re-read the Host's answer.
			*
			* A Host that does not know the field — an older plugin build still loaded in
			* the process — leaves the document unchanged, so the switch must snap back to
			* what the Host actually holds instead of showing a write that never took.
			*/
			async commit(field, value) {
				const accepted = await this.run("switch", async () => {
					await this.scope.set(field, value);
				}, "switch");
				this.failedSwitch = accepted ? null : {
					field,
					value
				};
				this.readFlags();
				this.publish();
			}
			saveDirectory() {
				if (!this.canWrite()) return;
				this.savedDirectory = this.directory.trim();
				this.publish();
				this.run("directory", () => this.commitDirectory(), "directory");
			}
			/** Write the directory field's committed value, and report the accepted write. */
			async commitDirectory() {
				if (await this.scope.set("directory", this.savedDirectory)) this.notice = {
					tone: "success",
					key: "notice.directorySaved"
				};
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
				this.run("index", async () => {
					await this.host.writeIndex(this.target, content);
					this.notice = {
						tone: "success",
						key: "notice.indexSaved"
					};
					await this.loadIndex(true);
				}, "index");
			}
			/** Read the index file, replacing the draft with what is on disk. */
			reloadIndex() {
				this.run("reload", () => this.loadIndex(false), "reload");
			}
			chooseDirectory() {
				this.run("browser", async () => {
					const picked = await this.host.pick();
					if (picked.ok) {
						if (picked.value !== null) {
							this.directory = picked.value;
							this.savedDirectory = picked.value.trim();
							await this.commitDirectory();
						}
						return;
					}
					if (!picked.unavailable) throw new Error(picked.message);
					await this.loadBrowser(void 0);
				});
			}
			browse(path) {
				this.run("browser", async () => {
					await this.loadBrowser(path);
				}, null);
			}
			useBrowsed() {
				if (this.browser.kind !== "ready") return;
				this.directory = this.browser.listing.path;
				this.browser = { kind: "closed" };
				this.saveDirectory();
			}
			refresh() {
				this.run("refresh", () => this.load(), "refresh");
			}
			/** Run the action the current failure notice reports. */
			retryNotice() {
				const retry = this.notice?.tone === "error" ? this.notice.retry : null;
				if (retry === "refresh") this.refresh();
				else if (retry === "directory") this.saveDirectory();
				else if (retry === "index") this.saveIndex();
				else if (retry === "reload") this.reloadIndex();
				else if (retry === "switch" && this.failedSwitch !== null) this.commit(this.failedSwitch.field, this.failedSwitch.value);
			}
			/** Read the picker, the report, and the index. */
			async load() {
				this.targets = await this.loadTargets();
				await this.loadStatus();
				await this.loadIndex(true);
			}
			async loadTargets() {
				try {
					const targets = await this.host.targets();
					return targets.length > 0 ? targets : this.targets;
				} catch {
					return this.targets;
				}
			}
			/**
			* Read the report.
			*
			* A read that fails keeps the last report on screen and reports the failure as
			* a notice, so a gateway that hiccups once does not replace what the account
			* already knows with an error page; only a read with nothing to show leaves
			* the block in its error state.
			*/
			async loadStatus() {
				try {
					const value = await this.host.status(this.target);
					this.target = value.target;
					this.status = {
						kind: "ready",
						value
					};
				} catch (error) {
					if (this.status.kind !== "ready") this.status = {
						kind: "error",
						message: messageOf(error)
					};
					this.notice = {
						tone: "error",
						message: messageOf(error),
						retry: "refresh"
					};
				}
			}
			/**
			* Read the index file.
			* @param keepDirty - keep an edited draft (a refresh) instead of replacing it
			* with the file's content (the explicit reload).
			*/
			async loadIndex(keepDirty) {
				try {
					const file = await this.host.readIndex(this.target);
					const previous = this.index;
					const draft = keepDirty && previous.kind === "ready" && previous.content !== previous.saved ? previous.content : file.content;
					this.index = {
						kind: "ready",
						exists: file.exists,
						content: draft,
						saved: file.content
					};
				} catch (error) {
					if (this.index.kind !== "ready") this.index = {
						kind: "error",
						message: messageOf(error)
					};
					this.notice = {
						tone: "error",
						message: messageOf(error),
						retry: "reload"
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
			/**
			* Run one action with the section's busy state and outcome around it.
			* @param kind - the write the controls disable themselves for while it runs.
			* @param action - the Host work.
			* @param retry - the action a failure notice runs again, or null when the
			* control that started it is still on screen as its own retry.
			* @returns whether the action completed without throwing.
			*/
			async run(kind, action, retry = null) {
				this.busy = kind;
				this.notice = null;
				this.publish();
				try {
					await action();
					return true;
				} catch (error) {
					this.notice = {
						tone: "error",
						message: messageOf(error),
						retry
					};
					return false;
				} finally {
					this.busy = "";
					this.publish();
				}
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
			"configForms",
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
			const controller = new MemorySectionController(ctx.configForms.get(MEMORY_SETTINGS_NS), {
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
			}, "ui-memory: settings form");
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
