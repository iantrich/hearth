/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const xe = globalThis, it = xe.ShadowRoot && (xe.ShadyCSS === void 0 || xe.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Xt = Symbol(), $t = /* @__PURE__ */ new WeakMap();
let qn = class {
  constructor(e, n, i) {
    if (this._$cssResult$ = !0, i !== Xt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = n;
  }
  get styleSheet() {
    let e = this.o;
    const n = this.t;
    if (it && e === void 0) {
      const i = n !== void 0 && n.length === 1;
      i && (e = $t.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), i && $t.set(n, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const Qt = (t) => new qn(typeof t == "string" ? t : t + "", void 0, Xt), Kn = (t, e) => {
  if (it) t.adoptedStyleSheets = e.map((n) => n instanceof CSSStyleSheet ? n : n.styleSheet);
  else for (const n of e) {
    const i = document.createElement("style"), s = xe.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = n.cssText, t.appendChild(i);
  }
}, xt = it ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((e) => {
  let n = "";
  for (const i of e.cssRules) n += i.cssText;
  return Qt(n);
})(t) : t;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Wn, defineProperty: Yn, getOwnPropertyDescriptor: Zn, getOwnPropertyNames: Jn, getOwnPropertySymbols: Xn, getPrototypeOf: Qn } = Object, Se = globalThis, wt = Se.trustedTypes, ei = wt ? wt.emptyScript : "", ti = Se.reactiveElementPolyfillSupport, te = (t, e) => t, ke = { toAttribute(t, e) {
  switch (e) {
    case Boolean:
      t = t ? ei : null;
      break;
    case Object:
    case Array:
      t = t == null ? t : JSON.stringify(t);
  }
  return t;
}, fromAttribute(t, e) {
  let n = t;
  switch (e) {
    case Boolean:
      n = t !== null;
      break;
    case Number:
      n = t === null ? null : Number(t);
      break;
    case Object:
    case Array:
      try {
        n = JSON.parse(t);
      } catch {
        n = null;
      }
  }
  return n;
} }, st = (t, e) => !Wn(t, e), _t = { attribute: !0, type: String, converter: ke, reflect: !1, useDefault: !1, hasChanged: st };
Symbol.metadata ??= Symbol("metadata"), Se.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let K = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, n = _t) {
    if (n.state && (n.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((n = Object.create(n)).wrapped = !0), this.elementProperties.set(e, n), !n.noAccessor) {
      const i = Symbol(), s = this.getPropertyDescriptor(e, i, n);
      s !== void 0 && Yn(this.prototype, e, s);
    }
  }
  static getPropertyDescriptor(e, n, i) {
    const { get: s, set: a } = Zn(this.prototype, e) ?? { get() {
      return this[n];
    }, set(r) {
      this[n] = r;
    } };
    return { get: s, set(r) {
      const l = s?.call(this);
      a?.call(this, r), this.requestUpdate(e, l, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? _t;
  }
  static _$Ei() {
    if (this.hasOwnProperty(te("elementProperties"))) return;
    const e = Qn(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(te("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(te("properties"))) {
      const n = this.properties, i = [...Jn(n), ...Xn(n)];
      for (const s of i) this.createProperty(s, n[s]);
    }
    const e = this[Symbol.metadata];
    if (e !== null) {
      const n = litPropertyMetadata.get(e);
      if (n !== void 0) for (const [i, s] of n) this.elementProperties.set(i, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [n, i] of this.elementProperties) {
      const s = this._$Eu(n, i);
      s !== void 0 && this._$Eh.set(s, n);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    const n = [];
    if (Array.isArray(e)) {
      const i = new Set(e.flat(1 / 0).reverse());
      for (const s of i) n.unshift(xt(s));
    } else e !== void 0 && n.push(xt(e));
    return n;
  }
  static _$Eu(e, n) {
    const i = n.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof e == "string" ? e.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
  }
  addController(e) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
  }
  removeController(e) {
    this._$EO?.delete(e);
  }
  _$E_() {
    const e = /* @__PURE__ */ new Map(), n = this.constructor.elementProperties;
    for (const i of n.keys()) this.hasOwnProperty(i) && (e.set(i, this[i]), delete this[i]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    const e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Kn(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((e) => e.hostDisconnected?.());
  }
  attributeChangedCallback(e, n, i) {
    this._$AK(e, i);
  }
  _$ET(e, n) {
    const i = this.constructor.elementProperties.get(e), s = this.constructor._$Eu(e, i);
    if (s !== void 0 && i.reflect === !0) {
      const a = (i.converter?.toAttribute !== void 0 ? i.converter : ke).toAttribute(n, i.type);
      this._$Em = e, a == null ? this.removeAttribute(s) : this.setAttribute(s, a), this._$Em = null;
    }
  }
  _$AK(e, n) {
    const i = this.constructor, s = i._$Eh.get(e);
    if (s !== void 0 && this._$Em !== s) {
      const a = i.getPropertyOptions(s), r = typeof a.converter == "function" ? { fromAttribute: a.converter } : a.converter?.fromAttribute !== void 0 ? a.converter : ke;
      this._$Em = s;
      const l = r.fromAttribute(n, a.type);
      this[s] = l ?? this._$Ej?.get(s) ?? l, this._$Em = null;
    }
  }
  requestUpdate(e, n, i, s = !1, a) {
    if (e !== void 0) {
      const r = this.constructor;
      if (s === !1 && (a = this[e]), i ??= r.getPropertyOptions(e), !((i.hasChanged ?? st)(a, n) || i.useDefault && i.reflect && a === this._$Ej?.get(e) && !this.hasAttribute(r._$Eu(e, i)))) return;
      this.C(e, n, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, n, { useDefault: i, reflect: s, wrapped: a }, r) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, r ?? n ?? this[e]), a !== !0 || r !== void 0) || (this._$AL.has(e) || (this.hasUpdated || i || (n = void 0), this._$AL.set(e, n)), s === !0 && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (n) {
      Promise.reject(n);
    }
    const e = this.scheduleUpdate();
    return e != null && await e, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [s, a] of this._$Ep) this[s] = a;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, a] of i) {
        const { wrapped: r } = a, l = this[s];
        r !== !0 || this._$AL.has(s) || l === void 0 || this.C(s, void 0, a, l);
      }
    }
    let e = !1;
    const n = this._$AL;
    try {
      e = this.shouldUpdate(n), e ? (this.willUpdate(n), this._$EO?.forEach((i) => i.hostUpdate?.()), this.update(n)) : this._$EM();
    } catch (i) {
      throw e = !1, this._$EM(), i;
    }
    e && this._$AE(n);
  }
  willUpdate(e) {
  }
  _$AE(e) {
    this._$EO?.forEach((n) => n.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(e) {
    return !0;
  }
  update(e) {
    this._$Eq &&= this._$Eq.forEach((n) => this._$ET(n, this[n])), this._$EM();
  }
  updated(e) {
  }
  firstUpdated(e) {
  }
};
K.elementStyles = [], K.shadowRootOptions = { mode: "open" }, K[te("elementProperties")] = /* @__PURE__ */ new Map(), K[te("finalized")] = /* @__PURE__ */ new Map(), ti?.({ ReactiveElement: K }), (Se.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const at = globalThis, kt = (t) => t, Ce = at.trustedTypes, Ct = Ce ? Ce.createPolicy("lit-html", { createHTML: (t) => t }) : void 0, en = "$lit$", O = `lit$${Math.random().toFixed(9).slice(2)}$`, tn = "?" + O, ni = `<${tn}>`, B = document, se = () => B.createComment(""), ae = (t) => t === null || typeof t != "object" && typeof t != "function", rt = Array.isArray, ii = (t) => rt(t) || typeof t?.[Symbol.iterator] == "function", Le = `[ 	
\f\r]`, Q = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Et = /-->/g, At = />/g, D = RegExp(`>|${Le}(?:([^\\s"'>=/]+)(${Le}*=${Le}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), St = /'/g, Tt = /"/g, nn = /^(?:script|style|textarea|title)$/i, sn = (t) => (e, ...n) => ({ _$litType$: t, strings: e, values: n }), o = sn(1), w = sn(2), N = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), Rt = /* @__PURE__ */ new WeakMap(), G = B.createTreeWalker(B, 129);
function an(t, e) {
  if (!rt(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Ct !== void 0 ? Ct.createHTML(e) : e;
}
const si = (t, e) => {
  const n = t.length - 1, i = [];
  let s, a = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", r = Q;
  for (let l = 0; l < n; l++) {
    const c = t[l];
    let h, u, f = -1, m = 0;
    for (; m < c.length && (r.lastIndex = m, u = r.exec(c), u !== null); ) m = r.lastIndex, r === Q ? u[1] === "!--" ? r = Et : u[1] !== void 0 ? r = At : u[2] !== void 0 ? (nn.test(u[2]) && (s = RegExp("</" + u[2], "g")), r = D) : u[3] !== void 0 && (r = D) : r === D ? u[0] === ">" ? (r = s ?? Q, f = -1) : u[1] === void 0 ? f = -2 : (f = r.lastIndex - u[2].length, h = u[1], r = u[3] === void 0 ? D : u[3] === '"' ? Tt : St) : r === Tt || r === St ? r = D : r === Et || r === At ? r = Q : (r = D, s = void 0);
    const _ = r === D && t[l + 1].startsWith("/>") ? " " : "";
    a += r === Q ? c + ni : f >= 0 ? (i.push(h), c.slice(0, f) + en + c.slice(f) + O + _) : c + O + (f === -2 ? l : _);
  }
  return [an(t, a + (t[n] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), i];
};
class re {
  constructor({ strings: e, _$litType$: n }, i) {
    let s;
    this.parts = [];
    let a = 0, r = 0;
    const l = e.length - 1, c = this.parts, [h, u] = si(e, n);
    if (this.el = re.createElement(h, i), G.currentNode = this.el.content, n === 2 || n === 3) {
      const f = this.el.content.firstChild;
      f.replaceWith(...f.childNodes);
    }
    for (; (s = G.nextNode()) !== null && c.length < l; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const f of s.getAttributeNames()) if (f.endsWith(en)) {
          const m = u[r++], _ = s.getAttribute(f).split(O), v = /([.?@])?(.*)/.exec(m);
          c.push({ type: 1, index: a, name: v[2], strings: _, ctor: v[1] === "." ? ri : v[1] === "?" ? oi : v[1] === "@" ? li : Te }), s.removeAttribute(f);
        } else f.startsWith(O) && (c.push({ type: 6, index: a }), s.removeAttribute(f));
        if (nn.test(s.tagName)) {
          const f = s.textContent.split(O), m = f.length - 1;
          if (m > 0) {
            s.textContent = Ce ? Ce.emptyScript : "";
            for (let _ = 0; _ < m; _++) s.append(f[_], se()), G.nextNode(), c.push({ type: 2, index: ++a });
            s.append(f[m], se());
          }
        }
      } else if (s.nodeType === 8) if (s.data === tn) c.push({ type: 2, index: a });
      else {
        let f = -1;
        for (; (f = s.data.indexOf(O, f + 1)) !== -1; ) c.push({ type: 7, index: a }), f += O.length - 1;
      }
      a++;
    }
  }
  static createElement(e, n) {
    const i = B.createElement("template");
    return i.innerHTML = e, i;
  }
}
function W(t, e, n = t, i) {
  if (e === N) return e;
  let s = i !== void 0 ? n._$Co?.[i] : n._$Cl;
  const a = ae(e) ? void 0 : e._$litDirective$;
  return s?.constructor !== a && (s?._$AO?.(!1), a === void 0 ? s = void 0 : (s = new a(t), s._$AT(t, n, i)), i !== void 0 ? (n._$Co ??= [])[i] = s : n._$Cl = s), s !== void 0 && (e = W(t, s._$AS(t, e.values), s, i)), e;
}
class ai {
  constructor(e, n) {
    this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = n;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(e) {
    const { el: { content: n }, parts: i } = this._$AD, s = (e?.creationScope ?? B).importNode(n, !0);
    G.currentNode = s;
    let a = G.nextNode(), r = 0, l = 0, c = i[0];
    for (; c !== void 0; ) {
      if (r === c.index) {
        let h;
        c.type === 2 ? h = new le(a, a.nextSibling, this, e) : c.type === 1 ? h = new c.ctor(a, c.name, c.strings, this, e) : c.type === 6 && (h = new ci(a, this, e)), this._$AV.push(h), c = i[++l];
      }
      r !== c?.index && (a = G.nextNode(), r++);
    }
    return G.currentNode = B, s;
  }
  p(e) {
    let n = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(e, i, n), n += i.strings.length - 2) : i._$AI(e[n])), n++;
  }
}
class le {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, n, i, s) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = e, this._$AB = n, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
  }
  get parentNode() {
    let e = this._$AA.parentNode;
    const n = this._$AM;
    return n !== void 0 && e?.nodeType === 11 && (e = n.parentNode), e;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(e, n = this) {
    e = W(this, e, n), ae(e) ? e === d || e == null || e === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : e !== this._$AH && e !== N && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : ii(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== d && ae(this._$AH) ? this._$AA.nextSibling.data = e : this.T(B.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: n, _$litType$: i } = e, s = typeof i == "number" ? this._$AC(e) : (i.el === void 0 && (i.el = re.createElement(an(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(n);
    else {
      const a = new ai(s, this), r = a.u(this.options);
      a.p(n), this.T(r), this._$AH = a;
    }
  }
  _$AC(e) {
    let n = Rt.get(e.strings);
    return n === void 0 && Rt.set(e.strings, n = new re(e)), n;
  }
  k(e) {
    rt(this._$AH) || (this._$AH = [], this._$AR());
    const n = this._$AH;
    let i, s = 0;
    for (const a of e) s === n.length ? n.push(i = new le(this.O(se()), this.O(se()), this, this.options)) : i = n[s], i._$AI(a), s++;
    s < n.length && (this._$AR(i && i._$AB.nextSibling, s), n.length = s);
  }
  _$AR(e = this._$AA.nextSibling, n) {
    for (this._$AP?.(!1, !0, n); e !== this._$AB; ) {
      const i = kt(e).nextSibling;
      kt(e).remove(), e = i;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class Te {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, n, i, s, a) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = e, this.name = n, this._$AM = s, this.options = a, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = d;
  }
  _$AI(e, n = this, i, s) {
    const a = this.strings;
    let r = !1;
    if (a === void 0) e = W(this, e, n, 0), r = !ae(e) || e !== this._$AH && e !== N, r && (this._$AH = e);
    else {
      const l = e;
      let c, h;
      for (e = a[0], c = 0; c < a.length - 1; c++) h = W(this, l[i + c], n, c), h === N && (h = this._$AH[c]), r ||= !ae(h) || h !== this._$AH[c], h === d ? e = d : e !== d && (e += (h ?? "") + a[c + 1]), this._$AH[c] = h;
    }
    r && !s && this.j(e);
  }
  j(e) {
    e === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class ri extends Te {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === d ? void 0 : e;
  }
}
class oi extends Te {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== d);
  }
}
class li extends Te {
  constructor(e, n, i, s, a) {
    super(e, n, i, s, a), this.type = 5;
  }
  _$AI(e, n = this) {
    if ((e = W(this, e, n, 0) ?? d) === N) return;
    const i = this._$AH, s = e === d && i !== d || e.capture !== i.capture || e.once !== i.once || e.passive !== i.passive, a = e !== d && (i === d || s);
    s && this.element.removeEventListener(this.name, this, i), a && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class ci {
  constructor(e, n, i) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = n, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    W(this, e);
  }
}
const di = at.litHtmlPolyfillSupport;
di?.(re, le), (at.litHtmlVersions ??= []).push("3.3.3");
const hi = (t, e, n) => {
  const i = n?.renderBefore ?? e;
  let s = i._$litPart$;
  if (s === void 0) {
    const a = n?.renderBefore ?? null;
    i._$litPart$ = s = new le(e.insertBefore(se(), a), a, void 0, n ?? {});
  }
  return s._$AI(t), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ot = globalThis;
let ne = class extends K {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    const n = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = hi(n, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return N;
  }
};
ne._$litElement$ = !0, ne.finalized = !0, ot.litElementHydrateSupport?.({ LitElement: ne });
const ui = ot.litElementPolyfillSupport;
ui?.({ LitElement: ne });
(ot.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const pi = { attribute: !0, type: String, converter: ke, reflect: !1, hasChanged: st }, fi = (t = pi, e, n) => {
  const { kind: i, metadata: s } = n;
  let a = globalThis.litPropertyMetadata.get(s);
  if (a === void 0 && globalThis.litPropertyMetadata.set(s, a = /* @__PURE__ */ new Map()), i === "setter" && ((t = Object.create(t)).wrapped = !0), a.set(n.name, t), i === "accessor") {
    const { name: r } = n;
    return { set(l) {
      const c = e.get.call(this);
      e.set.call(this, l), this.requestUpdate(r, c, t, !0, l);
    }, init(l) {
      return l !== void 0 && this.C(r, void 0, t, l), l;
    } };
  }
  if (i === "setter") {
    const { name: r } = n;
    return function(l) {
      const c = this[r];
      e.call(this, l), this.requestUpdate(r, c, t, !0, l);
    };
  }
  throw Error("Unsupported decorator location: " + i);
};
function ce(t) {
  return (e, n) => typeof n == "object" ? fi(t, e, n) : ((i, s, a) => {
    const r = s.hasOwnProperty(a);
    return s.constructor.createProperty(a, i), r ? Object.getOwnPropertyDescriptor(s, a) : void 0;
  })(t, e, n);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function mi(t) {
  return ce({ ...t, state: !0, attribute: !1 });
}
function gi(t) {
  return t && typeof t == "object" ? t : null;
}
class A extends Error {
  constructor(e, n, i, s = []) {
    super(n), this.code = e, this.field = i, this.problems = s, this.name = "HearthError";
  }
}
const vi = /^([A-Za-z_][\w.]*): /;
function Mt(t) {
  if (t instanceof A) return t;
  const e = t ?? {}, n = typeof e.message == "string" ? e.message : String(t);
  if (typeof e.code == "string" && e.code) {
    const i = e.code === "invalid" ? vi.exec(n)?.[1] : void 0;
    return new A(e.code, n, i);
  }
  return typeof e.code == "number" ? new A("offline", n) : t instanceof Error ? new A("unknown_error", n) : new A("offline", n);
}
class yi {
  /** `auth` is read when an upload starts, because Home Assistant swaps it when the token refreshes. */
  constructor(e, n = () => {
  }) {
    this.conn = e, this.auth = n;
  }
  async send(e) {
    try {
      return await this.conn.sendMessagePromise(e);
    } catch (n) {
      throw Mt(n);
    }
  }
  status() {
    return this.send({ type: "hearth_crm/crm/status" });
  }
  createCrm() {
    return this.send({ type: "hearth_crm/crm/create" });
  }
  snapshot() {
    return this.send({ type: "hearth_crm/snapshot" });
  }
  /**
   * Calls onChange for every change event, with the notice ({source, entity, entity_id, action}).
   * Resolves to an unsubscribe function.
   */
  async subscribe(e) {
    try {
      return await this.conn.subscribeMessage((n) => e(gi(n)), { type: "hearth_crm/subscribe" }, { resubscribe: !1 });
    } catch (n) {
      throw Mt(n);
    }
  }
  create(e, n) {
    return this.send({ type: "hearth_crm/create", kind: e, fields: n });
  }
  update(e, n, i) {
    return this.send({ type: "hearth_crm/update", kind: e, entity_id: n, changes: i });
  }
  remove(e, n) {
    return this.send({ type: "hearth_crm/delete", kind: e, entity_id: n });
  }
  /** `data` is the photo as base64, with no data: prefix. */
  setPhoto(e, n, i) {
    return this.send({ type: "hearth_crm/photo/set", kind: e, entity_id: n, data: i });
  }
  clearPhoto(e, n) {
    return this.send({ type: "hearth_crm/photo/clear", kind: e, entity_id: n });
  }
  /** Replaces the group's members with exactly `personIds`. */
  setGroupMembers(e, n) {
    return this.send({ type: "hearth_crm/group/set_members", group_id: e, person_ids: n });
  }
  settingsGet() {
    return this.send({ type: "hearth_crm/settings/get" });
  }
  settingsSet(e) {
    return this.send({ type: "hearth_crm/settings/set", changes: { me_person_id: e } });
  }
  notificationsGet() {
    return this.send({ type: "hearth_crm/notifications/get" });
  }
  /** Only what is mentioned changes. */
  notificationsSet(e) {
    return this.send({ type: "hearth_crm/notifications/set", changes: e });
  }
  /** Refused with code `no_phone` when the owner has no Companion app device. */
  notificationsTest() {
    return this.send({ type: "hearth_crm/notifications/test" });
  }
  googleStatus() {
    return this.send({ type: "hearth_crm/google/status" });
  }
  /** Refused with code `cutover_not_confirmed` until the CRM's cutover is confirmed. */
  googleSetEnabled(e) {
    return this.send({ type: "hearth_crm/google/set_enabled", enabled: e });
  }
  googleSyncNow() {
    return this.send({ type: "hearth_crm/google/sync_now" });
  }
  /** A dry run: local only, no Google call and nothing written. */
  googlePreview() {
    return this.send({ type: "hearth_crm/google/preview" });
  }
  /** Forgets the person's Google link, so the next run creates a fresh contact. */
  googleClearContact(e) {
    return this.send({ type: "hearth_crm/google/clear_contact", entity_id: e });
  }
  async exportBundle(e) {
    return (await this.send({
      type: "call_service",
      domain: "hearth_crm",
      service: "export",
      service_data: { config_entry_id: e },
      return_response: !0
    })).response;
  }
  /**
   * Uploads a bundle into the caller's own CRM (the server picks it from the token's user).
   * Refusals reject with a HearthError whose code is the server's `reason`.
   */
  async importBundle(e, n) {
    const i = this.auth();
    if (!i) throw new A("unknown_error", "Not signed in to Home Assistant.");
    const s = new FormData();
    s.append("file", e, e.name), s.append("replace_existing", n ? "true" : "false");
    let a;
    try {
      i.expired && await i.refreshAccessToken(), a = await fetch("/api/hearth_crm/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${i.data.access_token}` },
        body: s
      });
    } catch (l) {
      throw new A("offline", l instanceof Error ? l.message : String(l));
    }
    if (a.ok) return await a.json();
    let r = null;
    try {
      r = await a.json();
    } catch {
    }
    if (typeof r?.reason == "string") {
      const l = Array.isArray(r.problems) ? r.problems.filter((c) => typeof c == "string") : [];
      throw new A(r.reason, typeof r.message == "string" ? r.message : r.reason, void 0, l);
    }
    throw new A("import_failed", "Import failed unexpectedly; see the Home Assistant log.");
  }
}
const x = "/hearth";
function bi(t) {
  const e = t.split("/").filter(Boolean).map($i), [n, i, s] = e;
  switch (n) {
    case void 0:
      return { name: "home" };
    case "search":
      return { name: "search" };
    case "reach-out":
      return { name: "reachOut" };
    case "add":
      return { name: "add" };
    case "birthdays":
      return { name: "birthdays" };
    case "interactions":
      return { name: "interactions" };
    case "settings":
      return { name: "settings" };
    case "person":
      if (i && s === "edit") return { name: "personEdit", id: i };
      if (i && s === "relationship") {
        const a = e[3];
        if (a) return { name: "relationship", personId: i, relId: a === "new" ? null : a };
      }
      if (i) return { name: "person", id: i, sheet: s === "log" ? "log" : null };
      break;
    // Record ids are never "new".
    case "household":
      if (i === "new") return { name: "householdNew" };
      if (i && s === "edit") return { name: "householdEdit", id: i };
      if (i) return { name: "household", id: i };
      break;
    case "group":
      if (i === "new") return { name: "groupNew" };
      if (i && s === "edit") return { name: "groupEdit", id: i };
      if (i) return { name: "group", id: i };
      break;
    case "interaction":
      if (i) return { name: "interaction", id: i, sheet: s === "edit" ? "edit" : null };
      break;
  }
  return { name: "home" };
}
function $i(t) {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}
const R = encodeURIComponent, p = {
  home: () => x,
  search: () => `${x}/search`,
  reachOut: () => `${x}/reach-out`,
  add: () => `${x}/add`,
  birthdays: () => `${x}/birthdays`,
  interactions: () => `${x}/interactions`,
  settings: () => `${x}/settings`,
  person: (t) => `${x}/person/${R(t)}`,
  logInteraction: (t) => `${x}/person/${R(t)}/log`,
  editPerson: (t) => `${x}/person/${R(t)}/edit`,
  newRelationship: (t) => `${x}/person/${R(t)}/relationship/new`,
  relationship: (t, e) => `${x}/person/${R(t)}/relationship/${R(e)}`,
  household: (t) => `${x}/household/${R(t)}`,
  newHousehold: () => `${x}/household/new`,
  editHousehold: (t) => `${x}/household/${R(t)}/edit`,
  group: (t) => `${x}/group/${R(t)}`,
  newGroup: () => `${x}/group/new`,
  editGroup: (t) => `${x}/group/${R(t)}/edit`,
  interaction: (t) => `${x}/interaction/${R(t)}`,
  editInteraction: (t) => `${x}/interaction/${R(t)}/edit`
};
function xi(t) {
  return t === x || t.startsWith(`${x}/`) || t.startsWith(`${x}?`);
}
function wi(t) {
  switch (t.name) {
    case "home":
    case "search":
    case "reachOut":
    case "add":
      return t.name;
    default:
      return null;
  }
}
const Be = "hearthDepth";
function Fe() {
  const t = history.state?.[Be];
  return typeof t == "number" ? t : 0;
}
function z(t, e = !1) {
  e ? history.replaceState({ [Be]: Fe() }, "", t) : history.pushState({ [Be]: Fe() + 1 }, "", t), window.dispatchEvent(new Event("location-changed"));
}
function F(t) {
  Fe() > 0 ? history.back() : z(t, !0);
}
/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Pt = (t) => t ?? d;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const V = { ATTRIBUTE: 1, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4 }, rn = (t) => (...e) => ({ _$litDirective$: t, values: e });
let on = class {
  constructor(e) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(e, n, i) {
    this._$Ct = e, this._$AM = n, this._$Ci = i;
  }
  _$AS(e, n) {
    return this.update(e, n);
  }
  update(e, n) {
    return this.render(...n);
  }
};
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const _i = (t) => t.strings === void 0, ki = {}, ln = (t, e = ki) => t._$AH = e;
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ci = rn(class extends on {
  constructor() {
    super(...arguments), this.key = d;
  }
  render(t, e) {
    return this.key = t, e;
  }
  update(t, [e, n]) {
    return e !== this.key && (ln(t), this.key = e), n;
  }
});
function lt(t) {
  return /* @__PURE__ */ new Date(`${t}T00:00:00Z`);
}
const Ei = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), Ai = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), Si = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }), Ee = (t) => Ei.format(lt(t)), Ti = (t) => Ai.format(lt(t)), cn = (t) => Si.format(lt(t));
function Ri(t, e, n) {
  if (e) return Ee(t);
  const i = `${Ee(t)}, ${t.slice(0, 4)}`;
  return n === null ? i : `${i} - ${n}`;
}
function Mi(t) {
  return t === 0 ? "Today" : `In ${t} ${t === 1 ? "day" : "days"}`;
}
function Pi(t) {
  return t.trim().split(/\s+/).slice(0, 2).map((e) => e.charAt(0)).join("").toUpperCase();
}
function Re(t, e, n = `${e}s`) {
  return `${t} ${t === 1 ? e : n}`;
}
const C = (t) => w`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`, pe = (t) => w`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${t}</svg>`, b = {
  home: C(w`<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>`),
  search: C(w`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`),
  mic: pe(w`<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/>`),
  bell: C(w`<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`),
  plusCircle: C(w`<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>`),
  plus: C(w`<path d="M12 5v14M5 12h14"/>`),
  star: C(w`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  starFill: pe(w`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  phone: C(w`<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>`),
  message: C(w`<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.6A8.5 8.5 0 1 1 21 12z"/>`),
  envelope: C(w`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`),
  mapPin: C(w`<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`),
  globe: C(w`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>`),
  linkedIn: pe(w`<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/>`),
  facebook: pe(w`<path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2C16.7 2.1 15.7 2 14.6 2 12.2 2 10.6 3.4 10.6 6.1v2.4H8v3.3h2.6V22H14V11.8h2.6l.4-3.3z"/>`),
  instagram: C(w`<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>`),
  pencil: C(w`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`),
  trash: C(w`<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>`),
  back: C(w`<path d="m15 18-6-6 6-6"/>`),
  refresh: C(w`<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>`),
  gear: C(w`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`),
  menu: C(w`<path d="M4 6h16M4 12h16M4 18h16"/>`),
  close: C(w`<path d="M6 6l12 12M18 6 6 18"/>`)
};
function E(t, e, n = 42) {
  const i = Math.round(n * 15 / 42);
  return o`<span class="avatar" style="width:${n}px;height:${n}px;font-size:${i}px">
    ${Pi(t)}
    ${e ? Ci(
    e,
    o`<img src=${e} alt="" loading="lazy" @error=${(s) => s.target.classList.add("broken")} />`
  ) : d}
  </span>`;
}
function Ni(t, e = 42, n = 3) {
  const i = t.slice(0, n), s = t.length - i.length, a = Math.round(e / 3);
  return o`<span class="stack" aria-hidden="true">
    ${i.map(
    (r, l) => o`<span style="margin-left:${l === 0 ? 0 : -a}px;z-index:${i.length - l};display:inline-flex"
          >${E(r.name, r.photo_url, e)}</span
        >`
  )}
    ${s > 0 ? o`<span style="margin-left:${-a}px;z-index:${i.length + 1};display:inline-flex"
          ><span class="avatar" style="width:${e}px;height:${e}px;font-size:${Math.round(e * 15 / 42)}px;box-shadow:0 0 0 2px var(--surface)"
            >+${s}</span
          ></span
        >` : d}
  </span>`;
}
function je(t, e) {
  const n = t.contact_status, i = e ?? t.how_i_know_them?.trim() ?? "", s = n.days_since_contact === null ? "—" : `${n.days_since_contact}d ago`;
  return o`<a class="row" href=${p.person(t.id)}>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}${t.favorite ? o`<span class="star">${b.starFill}</span>` : d}</div>
      ${i ? o`<div class="sub">${i}</div>` : d}
    </span>
    <span class="meta ${n.urgency === "overdue" ? "danger" : ""}">${s}</span>
  </a>`;
}
function Ii(t) {
  return t.href ? o`<a
      class="icon-btn ${t.className ?? ""}"
      href=${t.href}
      target=${Pt(t.external ? "_blank" : void 0)}
      rel=${Pt(t.external ? "noopener noreferrer" : void 0)}
      aria-label=${t.label}
      title=${t.label}
      >${t.icon}</a
    >` : o`<button
    class="icon-btn ${t.className ?? ""}"
    @click=${t.onClick}
    ?disabled=${t.disabled ?? !1}
    aria-label=${t.label}
    title=${t.label}
  >
    ${t.icon}
  </button>`;
}
const Hi = (t) => o`<div class="label list-label">${t}</div>`;
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const k = rn(class extends on {
  constructor(t) {
    if (super(t), t.type !== V.PROPERTY && t.type !== V.ATTRIBUTE && t.type !== V.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
    if (!_i(t)) throw Error("`live` bindings can only contain a single expression");
  }
  render(t) {
    return t;
  }
  update(t, [e]) {
    if (e === N || e === d) return e;
    const n = t.element, i = t.name;
    if (t.type === V.PROPERTY) {
      if (e === n[i]) return N;
    } else if (t.type === V.BOOLEAN_ATTRIBUTE) {
      if (!!e === n.hasAttribute(i)) return N;
    } else if (t.type === V.ATTRIBUTE && n.getAttribute(i) === e + "") return N;
    return ln(t), e;
  }
}), Oi = () => ({
  name: "",
  phone: "",
  email: "",
  how_i_know_them: "",
  has_birthday: !1,
  birthday: "",
  birth_year_unknown: !1
}), Li = { name: 200, phone: 50, email: 500, how_i_know_them: 2e3 }, Ue = (t) => t.trim() || null, Nt = "add-person";
function Ui(t) {
  const e = t.drafts.open(Nt, p.add(), Oi), n = (r) => t.drafts.patch(Nt, r), i = e.name.trim() !== "" && (!e.has_birthday || e.birthday !== ""), s = (r, l, c = "text", h = "off") => o`<label class="field">
      <span>${l}</span>
      <input
        id=${`add-${r.replace(/_/g, "-")}`}
        class="input"
        type=${c}
        autocomplete=${h}
        maxlength=${Li[r]}
        .value=${k(e[r])}
        @input=${(u) => n({ [r]: u.target.value })}
      />
    </label>`, a = async () => {
    if (!i) return;
    const r = await t.addPerson({
      name: e.name,
      phone: Ue(e.phone),
      email: Ue(e.email),
      how_i_know_them: Ue(e.how_i_know_them),
      birthday: e.has_birthday ? e.birthday : null,
      birth_year_unknown: e.has_birthday && e.birth_year_unknown
    });
    r && z(p.person(r));
  };
  return {
    title: "Add person",
    back: !1,
    actions: [],
    body: o`<div class="page form">
      ${s("name", "Name")} ${s("phone", "Phone", "tel", "tel")} ${s("email", "Email", "email", "email")}
      ${s("how_i_know_them", "How I know them")}
      <label class="check">
        <input type="checkbox" .checked=${k(e.has_birthday)} @change=${(r) => n({ has_birthday: r.target.checked })} />
        Has a known birthday
      </label>
      ${e.has_birthday ? o`<label class="field">
              <span>Birthday</span>
              <input id="add-birthday" class="input" type="date" .value=${k(e.birthday)}
                @input=${(r) => n({ birthday: r.target.value })} />
            </label>
            <label class="check">
              <input
                type="checkbox"
                .checked=${k(e.birth_year_unknown)}
                @change=${(r) => n({ birth_year_unknown: r.target.checked })}
              />
              Year unknown
            </label>` : d}
      <button class="btn" ?disabled=${!i || t.busy} @click=${a}>Save</button>
    </div>`
  };
}
const zi = new Intl.Collator("en", { numeric: !0, sensitivity: "base" });
function U(t, e) {
  return zi.compare(t, e);
}
function Ve(t, e) {
  return U(t.name, e.name);
}
function Me(t) {
  return t.trim().split(/\s+/)[0] ?? "";
}
function Y(t) {
  return t.name_status !== "needs_name" && t.name_status !== "not_a_household" && !!t.name;
}
function H(t) {
  return Y(t) ? t.name : t.name_status === "not_a_household" ? "Not a household" : "Needs a name";
}
function ct(t, e) {
  const n = H(t);
  if (Y(t)) return n;
  const i = t.member_ids.map((s) => e.find((a) => a.id === s)).filter((s) => !!s).map((s) => Me(s.name)).filter(Boolean);
  return i.length ? `${n} (${i.join(", ")})` : n;
}
function dn(t, e) {
  return t.filter(
    (n) => n.days_until_birthday !== null && (e === void 0 || n.days_until_birthday <= e)
  ).sort((n, i) => n.days_until_birthday - i.days_until_birthday || U(n.name, i.name));
}
const Di = /^(\d{4})-(\d{2})-(\d{2})$/, Gi = 864e5;
function Bi(t) {
  const e = Di.exec(t);
  if (!e) throw new Error(`Not a calendar day: ${t}`);
  return Date.UTC(Number(e[1]), Number(e[2]) - 1, Number(e[3]));
}
function Fi(t, e) {
  return new Date(Bi(t) + e * Gi).toISOString().slice(0, 10);
}
const ji = 6;
function Vi(t) {
  return t.filter((e) => e.favorite).slice(0, ji);
}
function hn(t, e, n) {
  const i = new Set(e.map((a) => a.id)), { since: s } = n;
  return t.filter((a) => (s === void 0 || a.date >= s) && a.person_ids.some((r) => i.has(r))).sort(un).slice(0, n.limit);
}
function qi(t, e) {
  return t.filter((n) => n.person_ids.includes(e)).sort(un);
}
function un(t, e) {
  return t.date === e.date ? 0 : t.date > e.date ? -1 : 1;
}
function dt(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const i of e) n.has(i.id) || n.set(i.id, i);
  return t.person_ids.flatMap((i) => {
    const s = n.get(i);
    return s ? [s] : [];
  });
}
function Ki(t) {
  const e = (s) => Me(s.name) || s.name, [n, i] = t;
  return n ? i ? t.length === 2 ? `${e(n)} & ${e(i)}` : `${e(n)} and ${t.length - 1} others` : n.name : "";
}
function $(t) {
  if (!t.snapshot) throw new Error("No snapshot to draw from");
  return t.snapshot;
}
function j(t) {
  return { title: null, back: !0, actions: [], body: o`<div class="empty">This ${t} no longer exists.</div>` };
}
const Pe = {
  title: null,
  back: !0,
  actions: [],
  body: o`<div class="center"><div><div class="spinner"></div></div></div>`
};
function pn(t, e) {
  const n = e.length === 1 ? e[0] : void 0, i = o`${Ni(e)}<span class="name" style="flex:1;min-width:0"
      >${Ki(e)}</span
    >`;
  return o`<div class="row" style="flex-direction:column;align-items:stretch;gap:2px">
    <a
      href=${n ? p.person(n.id) : p.interaction(t.id)}
      style="display:flex;align-items:center;gap:12px"
      >${i}</a
    >
    <a href=${p.interaction(t.id)} style="display:flex;gap:12px">
      <span class="sub" style="flex:1">${t.summary}</span>
      <span class="meta">${Ee(t.date)}</span>
    </a>
  </div>`;
}
function Wi(t) {
  return o`<a class="row" href=${p.person(t.id)}>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${Mi(t.days_until_birthday ?? 0)}</div>
    </span>
  </a>`;
}
function Yi(t) {
  const { people: e, interactions: n, today: i } = $(t), s = Vi(e), a = dn(e, 30).slice(0, 3), r = hn(n, e, { since: Fi(i, -30), limit: 10 });
  return {
    title: "Hearth",
    back: !1,
    actions: [{ icon: b.gear, label: "Settings", href: p.settings() }],
    body: o`<div class="page">
      ${s.length ? o`<div class="list favorites" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 12px;padding:16px">
            ${s.map(
      (l) => o`<a href=${p.person(l.id)} style="display:grid;justify-items:center;gap:6px;min-width:0">
                ${E(l.name, l.photo_url, 56)}
                <span class="fav-name" style="font-weight:600;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >${Me(l.name)}</span
                >
              </a>`
    )}
          </div>` : d}

      <div class="section">
        <div class="section-head"><h2>Upcoming</h2><a href=${p.birthdays()}>See all</a></div>
        <div class="list">
          ${a.length ? a.map(Wi) : o`<div class="empty">No birthdays in the next 30 days.</div>`}
        </div>
      </div>

      <div class="section">
        <!-- "See more", not "See all": that list caps at 25. -->
        <div class="section-head"><h2>Recent</h2><a href=${p.interactions()}>See more</a></div>
        <div class="list">
          ${r.length ? r.map((l) => pn(l, dt(l, e))) : o`<div class="empty">Nothing logged in the last 30 days.</div>`}
        </div>
      </div>
    </div>`
  };
}
function Zi(t) {
  const e = dn($(t).people);
  return {
    title: "Birthdays",
    back: !0,
    actions: [],
    body: o`<div class="page list">
      ${e.length ? e.map((n) => {
      const i = n.days_until_birthday ?? 0;
      return o`<a class="row" href=${p.person(n.id)}>
              ${E(n.name, n.photo_url)}
              <span class="main"><div class="name">${n.name}</div></span>
              <span class="meta">${i === 0 ? "Today" : `${i}d`}</span>
            </a>`;
    }) : o`<div class="empty">No birthdays yet.</div>`}
    </div>`
  };
}
function Ji(t) {
  const { people: e, interactions: n } = $(t), i = hn(n, e, { limit: 25 });
  return {
    title: "Recent",
    back: !0,
    actions: [],
    body: o`<div class="page list">
      ${i.length ? i.map((s) => pn(s, dt(s, e))) : o`<div class="empty">No interactions yet.</div>`}
    </div>`
  };
}
function I(t) {
  return o`<div class="sheet-backdrop" style="align-items:center">
    <div class="dialog" role="alertdialog" aria-label=${t.title}>
      <div class="h-serif" style="font-size:17px">${t.title}</div>
      ${t.lines.map((e) => o`<div class="muted" style="font-size:12.5px">${e}</div>`)}
      <div class="actions">
        <button class="btn secondary" @click=${t.onCancel}>Cancel</button>
        <button class="btn danger" ?disabled=${t.busy ?? !1} @click=${t.onConfirm}>${t.confirmLabel}</button>
      </div>
    </div>
  </div>`;
}
function de(t, e) {
  return {
    get: (n) => (t.drafts.get(e) ?? {})[n],
    set: (n, i) => t.drafts.patch(e, { [n]: i }),
    error: (n) => fn(t.writeError, n)
  };
}
function fn(t, e) {
  const n = t?.field;
  if (!t || !n || n !== e && !n.startsWith(`${e}.`)) return null;
  const i = `${n}: `;
  return t.message.startsWith(i) ? t.message.slice(i.length) : t.message;
}
const Z = (t) => `field-${t.replace(/_/g, "-")}`, he = (t, e) => {
  const n = t.get(e);
  return typeof n == "string" ? n : "";
}, ht = (t) => t.target.value;
function J(t, e) {
  const n = t.error(e);
  return n ? o`<div class="field-error" role="alert" data-error-for=${e}>${n}</div>` : d;
}
function M(t, e, n, i = {}) {
  return o`<label class="field">
    <span>${n}</span>
    <input
      id=${Z(e)}
      name=${e}
      class="input"
      type=${i.type ?? "text"}
      autocomplete=${i.autocomplete ?? "off"}
      maxlength=${i.maxlength ?? 200}
      placeholder=${i.placeholder ?? ""}
      ?required=${i.required ?? !1}
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(he(t, e))}
      @input=${(s) => t.set(e, ht(s))}
    />
    ${J(t, e)}
  </label>`;
}
function oe(t, e, n, i) {
  return o`<label class="field">
    <span>${n}</span>
    <textarea
      id=${Z(e)}
      name=${e}
      class="input"
      maxlength=${i}
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(he(t, e))}
      @input=${(s) => t.set(e, s.target.value)}
    ></textarea>
    ${J(t, e)}
  </label>`;
}
function fe(t, e, n) {
  return o`<label class="field">
    <span>${n}</span>
    <input
      id=${Z(e)}
      name=${e}
      class="input"
      type="url"
      inputmode="url"
      autocapitalize="off"
      autocomplete="off"
      maxlength="500"
      placeholder="https://"
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(he(t, e))}
      @input=${(i) => t.set(e, ht(i))}
    />
    ${J(t, e)}
  </label>`;
}
function qe(t, e, n) {
  return M(t, e, n, { maxlength: 1e3 });
}
function Xi(t, e, n, i) {
  const s = he(t, e);
  return o`<label class="field">
      <span>${n}</span>
      <input
        id=${Z(e)}
        name=${e}
        class="input"
        type="date"
        aria-invalid=${t.error(e) ? "true" : "false"}
        .value=${k(s)}
        @input=${(a) => {
    const r = ht(a);
    t.set(e, r), r || t.set(i, !1);
  }}
      />
      ${J(t, e)}
    </label>
    ${s ? Ke(t, i, "Year unknown") : d}`;
}
function Ke(t, e, n) {
  return o`<label class="check">
      <input
        id=${Z(e)}
        name=${e}
        type="checkbox"
        .checked=${k(t.get(e) === !0)}
        @change=${(i) => t.set(e, i.target.checked)}
      />
      ${n}
    </label>
    ${J(t, e)}`;
}
function mn(t, e, n, i) {
  const s = he(t, e);
  return o`<label class="field">
    <span>${n}</span>
    <select
      id=${Z(e)}
      name=${e}
      class="input"
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(s)}
      @change=${(a) => t.set(e, a.target.value)}
    >
      ${i.map((a) => o`<option value=${a.value} ?selected=${a.value === s}>${a.label}</option>`)}
    </select>
    ${J(t, e)}
  </label>`;
}
const Qi = "https://claude.ai/new";
function es(t, e, n, i) {
  return t.drafts.open(e, n, () => {
    const { interaction_types: s, today: a } = $(t);
    return {
      type: i?.type ?? s[0] ?? "",
      date: i?.date ?? a,
      summary: i?.summary ?? "",
      notes: i?.notes ?? ""
    };
  });
}
const It = (t) => ({
  type: t.type,
  date: t.date,
  summary: t.summary.trim(),
  notes: t.notes.trim() || null
});
function gn(t, e, n) {
  const i = n ? `edit:${n.id}` : `log:${e.id}`, s = es(t, i, n ? p.editInteraction(n.id) : p.logInteraction(e.id), n), a = $(t).interaction_types, r = () => {
    t.drafts.drop(i), F(n ? p.interaction(n.id) : p.person(e.id));
  }, l = (m) => t.drafts.patch(i, m), c = s.summary.trim() !== "" && s.date !== "" && s.type !== "", h = (m) => fn(t.writeError, m), u = (m) => {
    const _ = h(m);
    return _ ? o`<div class="field-error" role="alert" data-error-for=${m}>${_}</div>` : d;
  }, f = async () => {
    if (!c) return;
    const m = It(s), _ = t.drafts.base(i);
    (n ? await t.updateInteraction(n.id, m, _ && It(_)) : await t.addInteraction({ person_ids: [e.id], ...m })) && r();
  };
  return o`<div class="sheet-backdrop" @click=${(m) => m.target === m.currentTarget && r()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit interaction" : "Log interaction"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${r}>Cancel</button>
        <span class="title" style="text-align:center">${n ? "Edit" : "Log"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!c || t.busy} @click=${f}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          <div class="field">
            <span>Person</span>
            <div style="display:flex;align-items:center;gap:10px">${E(e.name, e.photo_url, 26)} ${e.name}</div>
          </div>
          <div class="field">
            <span>Type</span>
            <div class="pills">
              ${a.map(
    (m) => o`<button
                  class="pill ${s.type === m ? "on" : ""}"
                  aria-pressed=${s.type === m ? "true" : "false"}
                  @click=${() => l({ type: m })}
                >
                  ${m}
                </button>`
  )}
            </div>
          </div>
          <label class="field">
            <span>Date</span>
            <input id="log-date" class="input" type="date" required .value=${k(s.date)}
              @input=${(m) => l({ date: m.target.value })} />
          </label>
          <label class="field">
            <span>Summary</span>
            <input id="log-summary" class="input" maxlength="300" aria-invalid=${h("summary") ? "true" : "false"}
              .value=${k(s.summary)} @input=${(m) => l({ summary: m.target.value })} />
            ${u("summary")}
          </label>
          <label class="field">
            <span>Notes</span>
            <textarea id="log-notes" class="input" maxlength="20000" aria-invalid=${h("notes") ? "true" : "false"}
              .value=${k(s.notes)} @input=${(m) => l({ notes: m.target.value })}></textarea>
            ${u("notes")}
          </label>
          <a href=${Qi} target="_blank" rel="noopener noreferrer" style="display:grid;justify-items:center;gap:8px;padding:8px 0">
            <span class="action primary" style="width:44px;height:44px;border-radius:50%">${b.mic}</span>
            <span class="muted" style="font-size:11.5px">Or tell Claude about it, and it logs it in Hearth for you.</span>
          </a>
        </div>
      </div>
    </div>
  </div>`;
}
function ts(t, e, n) {
  return [
    n ? { icon: b.pencil, label: "Edit", href: p.editInteraction(e.id) } : { icon: b.pencil, label: "Edit", disabled: !0 },
    {
      icon: b.trash,
      label: "Delete interaction",
      onClick: () => t.drafts.put(ut(e.id), p.interaction(e.id), {})
    }
  ];
}
const ut = (t) => `confirm-delete:interaction:${t}`;
function ns(t, e, n) {
  const i = ut(e.id);
  return I({
    title: "Delete this interaction?",
    lines: [`“${e.summary}” on ${cn(e.date)} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(i),
    onConfirm: async () => {
      await t.deleteInteraction(e.id) && (t.drafts.drop(i), F(n ? p.person(n.id) : p.home()));
    }
  });
}
function is(t, e, n) {
  const { interactions: i, people: s } = $(t), a = i.find((c) => c.id === e);
  if (!a) return j("interaction");
  const r = dt(a, s), l = r[0];
  return {
    title: null,
    back: !0,
    actions: ts(t, a, l),
    body: o`<div class="page" style="padding:20px;display:grid;gap:18px">
      ${r.length ? o`<div style="display:grid;gap:12px">
            ${r.length > 1 ? o`<div class="label">People</div>` : d}
            ${r.map(
      (c) => o`<a href=${p.person(c.id)} style="display:flex;align-items:center;gap:12px">
                ${E(c.name, c.photo_url)}<span class="accent" style="font-weight:600;font-size:15px">${c.name}</span>
              </a>`
    )}
          </div>` : d}
      <div>
        <div class="label">${cn(a.date)}</div>
        <div class="mono accent" style="font-size:10.5px">${a.type}</div>
      </div>
      <div class="h-serif" style="font-size:19px">${a.summary}</div>
      ${a.notes ? o`<div><div class="label" style="margin-bottom:6px">Notes</div><div style="white-space:pre-wrap">${a.notes}</div></div>` : d}
    </div>`,
    overlay: o`${n === "edit" && l ? gn(t, l, a) : d}${t.drafts.get(ut(e)) ? ns(t, a, l) : d}`
  };
}
function Ht(t) {
  return t.birthday && !t.birth_year_unknown ? t.birthday : null;
}
function vn(t, e) {
  const n = Ht(t), i = Ht(e);
  return n && i && n !== i ? n < i ? -1 : 1 : n && !i ? -1 : !n && i ? 1 : U(t.name, e.name);
}
const yn = [
  "Grandparent",
  "Parent",
  "Parent-in-law",
  "Pibling",
  "Spouse",
  "Partner",
  "Ex-Spouse",
  "Sibling",
  "Sibling-in-law",
  "Child",
  "Child-in-law",
  "Nibling",
  "Grandchild",
  "Friend",
  "College Friend",
  "Neighbor",
  "Coworker",
  "Former Coworker",
  "Mentor",
  "Mentee",
  "Employer",
  "Employee",
  "Extended Family",
  "In-Law",
  "Other"
], ss = new Map(yn.map((t, e) => [t, e]));
function Ot(t) {
  return (t === null ? void 0 : ss.get(t)) ?? yn.length;
}
function as(t) {
  return [...t].sort((e, n) => {
    const i = Ot(e.connectionType) - Ot(n.connectionType);
    return i !== 0 ? i : vn(e.person, n.person);
  });
}
const ie = { parent: 0, unplaced: 1, child: 2 };
function rs(t, e) {
  const n = new Set(t), i = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), a = (l, c) => {
    c === "Parent" ? i.add(l) : c === "Child" && s.add(l);
  };
  for (const l of e)
    !n.has(l.person_a_id) || !n.has(l.person_b_id) || (a(l.person_b_id, l.type), a(l.person_a_id, l.inverse_type));
  const r = /* @__PURE__ */ new Map();
  for (const l of t)
    i.has(l) ? r.set(l, ie.parent) : s.has(l) ? r.set(l, ie.child) : r.set(l, ie.unplaced);
  return r;
}
function pt(t, e, n, i) {
  const s = rs(e, n);
  return [...t].sort((a, r) => {
    const l = i(a), c = i(r), h = s.get(l.id) ?? ie.unplaced, u = s.get(c.id) ?? ie.unplaced;
    return h !== u ? h - u : vn(l, c);
  });
}
function Ne(t, e) {
  return t.person_a_id === t.person_b_id ? null : t.person_a_id === e ? { otherId: t.person_b_id, type: t.type } : t.person_b_id === e ? { otherId: t.person_a_id, type: t.inverse_type } : null;
}
function os(t) {
  return t.householdMembers.length === 0 && t.others.length === 0 && t.groups.length === 0;
}
function ls(t, e) {
  const { people: n, households: i, groups: s, relationships: a, excludedId: r } = e, l = /* @__PURE__ */ new Map();
  for (const y of n) l.has(y.id) || l.set(y.id, y);
  const c = /* @__PURE__ */ new Map(), h = [];
  for (const y of a) {
    const g = Ne(y, t);
    !g || g.otherId === r || c.has(g.otherId) || (c.set(g.otherId, { type: g.type, relationshipId: y.id }), h.push(g.otherId));
  }
  const u = (y) => {
    const g = l.get(y), T = c.get(y);
    return g ? { person: g, connectionType: T?.type ?? null, relationshipId: T?.relationshipId ?? null } : null;
  }, f = /* @__PURE__ */ new Set([t]), m = i.find((y) => y.member_ids.includes(t)) ?? null, _ = [];
  for (const y of m?.member_ids ?? []) {
    if (y === r || f.has(y)) continue;
    f.add(y);
    const g = u(y);
    g && _.push(g);
  }
  const v = pt(_, m?.member_ids ?? [], a, (y) => y.person), S = as(
    h.filter((y) => !f.has(y)).map(u).filter((y) => y !== null)
  );
  return {
    // Dropped when nobody is left to list under it, so the view never draws a household
    // heading over an empty group.
    household: v.length === 0 ? null : m,
    householdMembers: v,
    others: S,
    groups: s.filter((y) => y.member_ids.includes(t)).sort((y, g) => U(y.name, g.name))
  };
}
function ft(t, e, n) {
  const i = [...e].sort(Ve);
  if (t === "") return { direct: i, connected: [] };
  const s = t.toLocaleLowerCase(), a = i.filter((u) => u.name.toLocaleLowerCase().includes(s)), r = new Map(a.map((u) => [u.id, u])), l = /* @__PURE__ */ new Map();
  for (const u of i) l.has(u.id) || l.set(u.id, u);
  const c = [], h = new Set(r.keys());
  for (const u of n) {
    const f = [u.person_a_id, u.person_b_id].find((S) => r.has(S));
    if (f === void 0) continue;
    const m = Ne(u, f);
    if (!m || h.has(m.otherId)) continue;
    h.add(m.otherId);
    const _ = l.get(m.otherId), v = r.get(f);
    !_ || !v || c.push({ person: _, reason: `${m.type} of ${v.name}` });
  }
  return { direct: a, connected: c.sort((u, f) => Ve(u.person, f.person)) };
}
const cs = 8, ds = 200;
function mt(t, e) {
  const { people: n, relationships: i } = $(t), s = `picker:${e.id}`, a = t.drafts.open(s, e.path, () => ({ query: "" })).query, r = e.selected ?? [], l = /* @__PURE__ */ new Set([...e.exclude ?? [], ...r]), c = r.map((v) => n.find((S) => S.id === v)).filter((v) => !!v), h = a.trim(), u = [];
  if (h) {
    const v = ft(h, n, i);
    for (const S of v.direct) u.push({ person: S });
    for (const S of v.connected) u.push(S);
  }
  const f = u.filter((v) => !l.has(v.person.id)).slice(0, cs), m = (v) => {
    t.drafts.patch(s, { query: "" }), e.onPick(v);
  }, _ = () => {
    t.drafts.patch(s, { query: "" }), e.onCreate?.(h);
  };
  return o`<div class="field person-picker">
    <label for=${e.id}><span>${e.label}</span></label>
    ${c.length ? o`<div class="chips">
          ${c.map(
    (v) => o`<span class="chip">
              ${E(v.name, v.photo_url, 18)} ${v.name}
              ${e.onRemove ? o`<button
                    class="chip-remove"
                    aria-label=${`Remove ${v.name}`}
                    title=${`Remove ${v.name}`}
                    ?disabled=${e.disabled ?? !1}
                    @click=${() => e.onRemove(v.id)}
                  >
                    ×
                  </button>` : d}
            </span>`
  )}
        </div>` : d}
    <input
      id=${e.id}
      class="input"
      type="search"
      placeholder="Search people"
      autocomplete="off"
      .value=${k(a)}
      @input=${(v) => t.drafts.patch(s, { query: v.target.value })}
    />
    ${h ? o`<div class="list">
          ${f.length ? f.map(
    ({ person: v, reason: S }) => o`<button
                  class="row picker-choice"
                  ?disabled=${e.disabled ?? !1}
                  @click=${() => m(v.id)}
                >
                  ${E(v.name, v.photo_url)}
                  <span class="main">
                    <div class="name">${v.name}</div>
                    ${S ? o`<div class="sub">${S}</div>` : d}
                  </span>
                </button>`
  ) : o`<div class="empty">No one matches “${h}”.</div>`}
          ${e.onCreate ? o`<button
                class="row picker-create"
                ?disabled=${(e.disabled ?? !1) || h.length > ds}
                @click=${_}
              >
                <span class="main"><div class="name accent">Create “${h}”</div></span>
              </button>` : d}
        </div>` : d}
  </div>`;
}
const bn = "That file isn't a photo Hearth can use.", hs = 4e6;
class ee extends Error {
  constructor(e = bn) {
    super(e), this.name = "PhotoUnusable";
  }
}
const $n = {
  decode: (t) => createImageBitmap(t, { imageOrientation: "from-image" }),
  async encode(t, e, n, i) {
    const s = t;
    if (typeof OffscreenCanvas < "u") {
      const r = new OffscreenCanvas(e, n);
      return Lt(r.getContext("2d"), s, e, n), r.convertToBlob({ type: "image/jpeg", quality: i });
    }
    const a = document.createElement("canvas");
    return a.width = e, a.height = n, Lt(a.getContext("2d"), s, e, n), new Promise(
      (r, l) => a.toBlob((c) => c ? r(c) : l(new Error("encoding failed")), "image/jpeg", i)
    );
  }
};
function Lt(t, e, n, i) {
  if (!t) throw new Error("no 2d canvas");
  t.fillStyle = "white", t.fillRect(0, 0, n, i), t.drawImage(e, 0, 0, n, i);
}
function us(t) {
  let e = "";
  for (let i = 0; i < t.length; i += 32768) e += String.fromCharCode(...t.subarray(i, i + 32768));
  return btoa(e);
}
async function ps(t, e = 1024, n = 0.85, i = $n) {
  let s;
  try {
    s = await i.decode(t);
  } catch {
    throw new ee();
  }
  try {
    const { width: a, height: r } = s;
    if (!(a > 0 && r > 0)) throw new ee();
    const l = Math.min(1, e / Math.max(a, r)), c = Math.max(1, Math.round(a * l)), h = Math.max(1, Math.round(r * l));
    let u;
    try {
      u = await i.encode(s, c, h, n);
    } catch {
      throw new ee();
    }
    let f;
    try {
      f = us(new Uint8Array(await u.arrayBuffer()));
    } catch {
      throw new ee();
    }
    if (f.length > hs) throw new ee();
    return f;
  } finally {
    s.close?.();
  }
}
async function fs(t, e, n, i, s = $n) {
  if (t.shrinkingPhoto) return !1;
  let a;
  t.setShrinkingPhoto(!0);
  try {
    a = await ps(i, 1024, 0.85, s);
  } catch {
    return t.showToast(bn), !1;
  } finally {
    t.setShrinkingPhoto(!1);
  }
  return t.setPhoto(e, n, a);
}
function xn(t, e, n, i) {
  return o`<input class="file-input" type="file" accept="image/*" ?disabled=${i} @change=${(a) => {
    const r = a.target, l = r.files?.[0];
    r.value = "", l && fs(t, e, n, l);
  }} />`;
}
const wn = (t) => t.busy || t.shrinkingPhoto;
function gt(t, e) {
  const { kind: n, id: i, name: s, photoUrl: a } = e, r = wn(t);
  return o`<div class="photo-picker">
    ${E(s, a, 76)}
    <div class="actions">
      <label class="btn secondary file-btn" aria-disabled=${r ? "true" : "false"}>
        ${t.shrinkingPhoto ? "Preparing photo…" : a ? "Change photo" : "Add photo"} ${xn(t, n, i, r)}
      </label>
      ${a ? o`<button class="btn secondary" ?disabled=${r} @click=${() => void t.clearPhoto(n, i)}>Remove photo</button>` : d}
    </div>
  </div>`;
}
function ms(t, e, n = 76) {
  const { kind: i, id: s, name: a, photoUrl: r } = e, l = wn(t), c = r ? "Change photo" : "Add photo";
  return o`<label class="file-btn photo-tap" aria-label=${c} title=${c} aria-disabled=${l ? "true" : "false"}>
    ${E(a, r, n)} ${xn(t, i, s, l)}
  </label>`;
}
function vt(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const a of e) n.has(a.id) || n.set(a.id, a);
  const i = /* @__PURE__ */ new Set(), s = [];
  for (const a of t) {
    if (i.has(a)) continue;
    i.add(a);
    const r = n.get(a);
    r && s.push(r);
  }
  return s.sort(Ve);
}
const _n = (t) => `edit:group:${t}`, me = "edit:group:new", We = (t) => `confirm-delete:group:${t}`, ze = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`;
function kn(t, e, n) {
  const i = de(t, e), s = { ...i, error: (a) => a === "name" && n ? "Enter a name." : i.error(a) };
  return o`${M(s, "name", "Name", { required: !0, maxlength: 200 })}
  ${oe(s, "description", "Description", 2e4)}`;
}
function gs(t) {
  const n = !t.drafts.open(me, p.newGroup(), () => ({ name: "", description: "" })).name.trim(), i = async () => {
    const s = t.drafts.get(me);
    if (!s || !s.name.trim()) return;
    const a = await t.save("contact_group", null, { ...s });
    a && (t.drafts.drop(me), z(p.editGroup(a.id), !0));
  };
  return {
    title: "New group",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${kn(t, me, n)}
      <button class="btn" ?disabled=${n || t.busy} @click=${i}>Create group</button>
    </div>`
  };
}
function vs(t, e) {
  const n = vt(e.member_ids, $(t).people);
  return mt(t, {
    id: "group-members",
    label: "Add a member",
    path: p.editGroup(e.id),
    selected: n.map((i) => i.id),
    // Built from store.groupMembers, so a change made before the last one reaches the snapshot isn't undone.
    onPick: (i) => void t.setGroupMembers(e.id, [...t.groupMembers(e.id).filter((s) => s !== i), i]),
    onRemove: (i) => void t.setGroupMembers(e.id, t.groupMembers(e.id).filter((s) => s !== i)),
    disabled: t.busy
  });
}
function ys(t, e) {
  const n = We(e.id), i = e.member_ids.length;
  return I({
    title: `Delete ${e.name}?`,
    lines: [`${i} ${i === 1 ? "person stays" : "people stay"}; they just leave this group.`, "This can't be undone."],
    confirmLabel: "Delete group",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("contact_group", e.id) && (t.drafts.drop(n), t.drafts.drop(_n(e.id)), t.setSearch({ chip: "groups" }), z(p.search(), !0));
    }
  });
}
function bs(t, e) {
  const n = $(t).groups.find((c) => c.id === e);
  if (!n) return t.isArriving(e) ? Pe : j("group");
  const i = _n(e), s = p.editGroup(e), r = !t.drafts.open(i, s, () => ({ name: n.name, description: n.description ?? "" })).name.trim(), l = async () => {
    const c = t.drafts.get(i), h = t.drafts.base(i);
    !c || !h || !c.name.trim() || await t.save("contact_group", e, { ...c }, { ...h }) && (t.drafts.drop(i), F(p.group(e)));
  };
  return {
    title: "Edit group",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${ze("Photo", gt(t, { kind: "contact_group", id: e, name: n.name, photoUrl: n.photo_url }))}
      ${ze("Details", kn(t, i, r))}
      <button class="btn" ?disabled=${r || t.busy} @click=${l}>Save</button>
      ${ze("Members", vs(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(We(e), s, {})}>
        Delete group
      </button>
    </div>`,
    overlay: t.drafts.get(We(e)) ? ys(t, n) : void 0
  };
}
const Cn = (t) => ({
  name: t.trim(),
  phone: null,
  email: null,
  how_i_know_them: null,
  birthday: null,
  birth_year_unknown: !1
}), $s = "Name (leave blank to use the generated name)", En = (t) => `edit:household:${t}`, ge = "edit:household:new", Ie = (t) => `confirm-delete:household:${t}`, He = (t) => `confirm-dissolve:household:${t}`, Oe = (t) => `confirm-move:household:${t}`, De = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`, Ye = (t) => ({ name_override: t.name_override, address: t.address, notes: t.notes });
function An(t, e) {
  const n = M(t, "name_override", $s, { maxlength: 200 });
  return o`${e ? o`<div class="highlight">${n}</div>` : n} ${qe(t, "address", "Address")}
  ${oe(t, "notes", "Notes", 2e4)}`;
}
function xs(t) {
  const e = p.newHousehold();
  t.drafts.open(ge, e, () => ({ name_override: "", address: "", notes: "" }));
  const n = async () => {
    const i = t.drafts.get(ge);
    if (!i) return;
    const s = await t.save("household", null, Ye(i));
    s && (t.drafts.drop(ge), z(p.editHousehold(s.id), !0));
  };
  return {
    title: "New household",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${An(de(t, ge), !1)}
      <button class="btn" ?disabled=${t.busy} @click=${n}>Create household</button>
    </div>`
  };
}
function ws(t, e) {
  const n = p.editHousehold(e.id);
  let i = d;
  switch (e.name_status) {
    case "generated":
      i = o`<div class="muted" style="font-size:12.5px">Named from its members.</div>`;
      break;
    case "override":
      i = o`<div class="muted" style="font-size:12.5px">The name you gave it.</div>`;
      break;
    case "needs_name":
      i = o`<div class="warning household-status" style="font-size:12.5px">This household needs a name</div>`;
      break;
    case "not_a_household":
      i = o`<div class="warning household-status" style="font-size:12.5px">
          This isn't a household any more (one adult, no children)
        </div>
        <button
          class="btn secondary"
          style="justify-self:start"
          ?disabled=${t.busy}
          @click=${() => t.drafts.put(He(e.id), n, {})}
        >
          Dissolve household
        </button>`;
      break;
  }
  return o`<div style="display:grid;gap:6px">
    <div class="h-serif members-title ${Y(e) ? "" : "muted"}" style="font-size:21px">${H(e)}</div>
    ${i}
  </div>`;
}
const Ze = (t, e, n) => t.save("person", e, { household_id: n });
function _s(t, e) {
  const { people: n, relationships: i } = $(t), s = pt(vt(e.member_ids, n), e.member_ids, i, (l) => l), a = p.editHousehold(e.id), r = (l) => {
    const c = n.find((h) => h.id === l);
    if (c?.household_id && c.household_id !== e.id) {
      t.drafts.put(Oe(e.id), a, { personId: l });
      return;
    }
    Ze(t, l, e.id);
  };
  return mt(t, {
    id: "household-members",
    label: "Add a member",
    path: a,
    selected: s.map((l) => l.id),
    onPick: r,
    onRemove: (l) => void Ze(t, l, null),
    // A new person goes straight into this household, so they needn't be in the snapshot first.
    onCreate: (l) => void t.addPerson({ ...Cn(l), household_id: e.id }),
    disabled: t.busy
  });
}
function ks(t, e, n) {
  const i = Oe(e.id), s = $(t), a = s.households.find((l) => l.id === n.household_id), r = a ? ct(a, s.people) : "their household";
  return I({
    title: `Move ${n.name} from ${r} to this household?`,
    lines: ["A person can only be in one household."],
    confirmLabel: "Move",
    busy: t.busy,
    onCancel: () => t.drafts.drop(i),
    onConfirm: async () => {
      await Ze(t, n.id, e.id) && t.drafts.drop(i);
    }
  });
}
const Cs = (t) => `${t} ${t === 1 ? "person stays" : "people stay"}; they just won't have a household.`;
function Sn(t, e) {
  for (const n of [En(e), Ie(e), He(e), Oe(e)]) t.drafts.drop(n);
  t.setSearch({ chip: "households" }), z(p.search(), !0);
}
function Es(t, e) {
  const n = Ie(e.id);
  return I({
    title: `Delete ${H(e)}?`,
    lines: [Cs(e.member_ids.length), "This can't be undone."],
    confirmLabel: "Delete household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && Sn(t, e.id);
    }
  });
}
function As(t, e) {
  const n = He(e.id);
  return I({
    title: "Dissolve this household?",
    lines: ["Members stay; they just won't have a household."],
    confirmLabel: "Dissolve household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && Sn(t, e.id);
    }
  });
}
function Ss(t, e) {
  const n = e.id;
  if (t.drafts.get(Ie(n))) return Es(t, e);
  if (t.drafts.get(He(n))) return As(t, e);
  const i = t.drafts.get(Oe(n)), s = i && $(t).people.find((a) => a.id === i.personId);
  return s ? ks(t, e, s) : void 0;
}
function Ts(t, e) {
  const n = $(t).households.find((r) => r.id === e);
  if (!n) return t.isArriving(e) ? Pe : j("household");
  const i = En(e), s = p.editHousehold(e);
  t.drafts.open(i, s, () => ({
    name_override: n.name_override ?? "",
    address: n.address?.formatted ?? "",
    notes: n.notes ?? ""
  }));
  const a = async () => {
    const r = t.drafts.get(i), l = t.drafts.base(i);
    !r || !l || await t.save("household", e, Ye(r), Ye(l)) && (t.drafts.drop(i), F(p.household(e)));
  };
  return {
    title: "Edit household",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${ws(t, n)}
      ${De("Photo", gt(t, { kind: "household", id: e, name: H(n), photoUrl: n.photo_url }))}
      ${De("Details", An(de(t, i), n.name_status === "needs_name"))}
      <button class="btn" ?disabled=${t.busy} @click=${a}>Save</button>
      ${De("Members", _s(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(Ie(e), s, {})}>
        Delete household
      </button>
    </div>`,
    overlay: Ss(t, n)
  };
}
function Tn(t, e, n, i) {
  const { people: s, relationships: a } = $(t), r = vt(n, s), l = i ? pt(r, n, a, (c) => c) : r;
  return {
    title: null,
    back: !0,
    actions: [{ icon: b.pencil, label: "Edit", href: e.editHref }],
    body: o`<div class="page">
      <div style="padding:16px">
        <div class="h-serif members-title ${e.muted ? "muted" : ""}" style="font-size:21px">${e.title}</div>
        ${e.subtitle ? o`<div class="muted" style="font-size:12.5px;margin-top:4px">${e.subtitle}</div>` : d}
        ${e.prompt ? o`<a class="warning name-prompt" style="display:block;font-size:12.5px;margin-top:4px" href=${e.prompt.href}>${e.prompt.text}</a>` : d}
        <!-- The members actually shown, not the raw id count. -->
        <div class="label" style="margin-top:6px">${Re(l.length, "member").toUpperCase()}</div>
      </div>
      <div class="list">${l.map((c) => je(c))}</div>
    </div>`
  };
}
function Rs(t, e) {
  const n = $(t).households.find((r) => r.id === e);
  if (!n) return j("household");
  const i = p.editHousehold(e), s = n.name_status === "needs_name" ? { text: "This household needs a name. Name it", href: i } : n.name_status === "not_a_household" ? { text: "This isn't a household any more. Review it", href: i } : null, a = { title: H(n), muted: !Y(n), subtitle: null, prompt: s, editHref: i };
  return Tn(t, a, n.member_ids, !0);
}
function Ms(t, e) {
  const n = $(t).groups.find((i) => i.id === e);
  return n ? Tn(t, { title: n.name, muted: !1, subtitle: n.description, prompt: null, editHref: p.editGroup(e) }, n.member_ids, !1) : j("group");
}
function Rn(t) {
  if (!t) return null;
  if (t.startsWith("+")) {
    const n = t.slice(1).replace(/\D/g, "");
    return n.length >= 8 ? `+${n}` : null;
  }
  const e = t.replace(/\D/g, "");
  return e.length === 10 ? `+1${e}` : e.length === 11 && e.startsWith("1") ? `+${e}` : null;
}
function Ps(t) {
  const e = Rn(t);
  return e ? `tel:${e}` : null;
}
function Ns(t) {
  const e = Rn(t);
  return e ? `sms:${e}` : null;
}
function Is(t) {
  const e = t?.trim() ?? "";
  return e === "" || /\s/.test(e) ? null : `mailto:${e}`;
}
function Ut(t) {
  return t ? typeof t.lat == "number" && typeof t.lon == "number" ? !0 : (t.formatted?.trim() ?? "") !== "" : !1;
}
function Hs(t, e) {
  return Ut(t.address) ? t.address : Ut(e?.address) ? e.address : null;
}
function Os(t, e) {
  const n = Hs(t, e);
  if (!n) return null;
  const i = n.formatted ?? "";
  return typeof n.lat == "number" && typeof n.lon == "number" ? `https://maps.apple.com/?ll=${n.lat},${n.lon}&q=${encodeURIComponent(i)}` : i ? `https://maps.apple.com/?q=${encodeURIComponent(i)}` : null;
}
function ve(t) {
  const e = t?.trim() ?? "";
  if (!e) return null;
  try {
    const n = new URL(e);
    return n.protocol === "http:" || n.protocol === "https:" ? n.href : null;
  } catch {
    return null;
  }
}
const Ls = "/config/integrations/integration/hearth_crm", Mn = "contact missing", Pn = "create uncertain", we = "confirm-google-enable", _e = "confirm-google-clear";
function Nn(t) {
  switch (t) {
    case Mn:
      return "This contact was deleted in Google.";
    case Pn:
      return "Hearth couldn't confirm whether Google created this contact.";
    default:
      return t;
  }
}
function In(t) {
  switch (t.stopped_reason) {
    case "auth":
      return "Google needs you to sign in again (Settings → Devices & services → Hearth).";
    case "rate_limited":
      return "Google asked Hearth to slow down; it will continue on the next sweep.";
    case "api_disabled":
      return "The Google People API isn't enabled or Hearth lacks permission. Enable the People API for your Google Cloud project, or reconnect (Settings → Devices & services → Hearth → Reconfigure).";
    case "disabled":
      return "Stopped because the sync was switched off.";
    case "account_mismatch":
      return "These contacts weren't found in the connected Google account. Is it the same account the contacts were first synced to? Nothing was changed.";
    default:
      return null;
  }
}
function Us(t) {
  const e = new Date(t);
  return Number.isNaN(e.getTime()) ? t : e.toLocaleString();
}
function Hn(t) {
  const e = [`${t.created} created`, `${t.updated} updated`];
  return t.photos && e.push(`${t.photos} photos`), t.errors && e.push(`${t.errors} with errors`), t.missing && e.push(`${t.missing} missing in Google`), t.pending && e.push(`${t.pending} still to do`), e.join(", ");
}
function zs() {
  return o`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">
      Hearth can keep your contacts in your Google account up to date. It's optional, and Hearth works the same without it.
    </div>
    <div class="muted" style="font-size:12.5px">
      To connect: Settings → Devices & services → Hearth → Reconfigure.
    </div>
    <a class="accent" style="font-size:12.5px" href=${Ls} target="_blank" rel="noopener noreferrer">Open Hearth in Home Assistant</a>
  </div>`;
}
function Ds(t) {
  const { counts: e, last_run: n } = t, i = n ? In(n) : null;
  return o`<div id="google-status" style="display:grid;gap:4px;font-size:12.5px">
    <div>
      ${e.synced} synced, ${e.pending} waiting, ${e.skipped} skipped${e.missing ? o`, ${e.missing} missing in Google` : d}${e.errors ? o`, ${e.errors} with errors` : d}
    </div>
    ${t.running ? o`<div class="muted">Syncing now…</div>` : d}
    ${n && !n.dry_run ? o`<div class="muted">Last run ${Us(n.started_at)}: ${Hn(n)}</div>` : o`<div class="muted">No sync has run yet.</div>`}
    ${i ? o`<div role="alert">${i}</div>` : d}
    ${t.last_error ? o`<div role="alert">The last run failed: ${t.last_error}</div>` : d}
  </div>`;
}
function Gs(t, e) {
  const n = !e.cutover_confirmed && !e.enabled, i = (s) => {
    const a = s.target;
    a.checked ? (a.checked = !1, t.drafts.put(we, p.settings(), {})) : t.setGoogleEnabled(!1);
  };
  return o`<div style="display:grid;gap:4px">
    <label class="check">
      <input
        id="google-enable"
        type="checkbox"
        role="switch"
        ?disabled=${n || t.busy}
        aria-describedby=${n ? "google-enable-why" : d}
        .checked=${k(e.enabled)}
        @change=${i}
      />
      <span>Keep Google Contacts up to date</span>
    </label>
    ${n ? o`<div class="muted" id="google-enable-why" style="font-size:12.5px">
          Available once cutover is confirmed, so test edits in Hearth never reach your Google account. Run the Hearth “Confirm cutover” action (Developer tools → Actions) once your import is final. You can still preview below.
        </div>` : d}
  </div>`;
}
function Bs(t) {
  const e = t.created - t.would_create.length;
  return o`<div id="google-preview" role="status" style="display:grid;gap:6px;font-size:12.5px">
    <div>
      Would create ${t.created}, update ${t.updated}, skip ${t.skipped}${t.photos ? `, and ${t.photos} ${t.photos === 1 ? "photo" : "photos"} to upload` : d}
    </div>
    ${t.would_create.length ? o`<div class="muted">Would create:</div>
          <ul style="margin:0;padding-left:18px">
            ${t.would_create.map((n) => o`<li>${n}</li>`)}
          </ul>
          ${e > 0 ? o`<div class="muted" id="google-preview-more">and ${e} more</div>` : d}` : d}
  </div>`;
}
function Fs(t) {
  const e = In(t);
  return o`<div id="google-sync-result" role="status" style="display:grid;gap:4px;font-size:12.5px">
    <div>Sync finished: ${Hn(t)}</div>
    ${e ? o`<div>${e}</div>` : d}
  </div>`;
}
function js(t) {
  return $(t).people.filter((e) => e.google_sync_error);
}
function Vs(t) {
  const e = js(t);
  return e.length ? o`<div id="google-problems" style="display:grid;gap:10px">
    <div class="label" style="padding:0">Needs attention</div>
    ${e.map((n) => {
    const i = n.google_sync_error, s = i === Pn && !n.google_contact_id, a = s || i === Mn && !!n.google_contact_id;
    return o`<div class="google-problem" style="display:flex;align-items:center;gap:10px">
        <span style="flex:1;min-width:0">
          <a href=${p.person(n.id)} style="font-weight:600">${n.name}</a>
          <div class="muted" style="font-size:12.5px">${Nn(i)}</div>
        </span>
        ${a ? o`<button
              class="btn secondary"
              ?disabled=${t.busy}
              @click=${() => t.drafts.put(_e, p.settings(), { personId: n.id, uncertain: s })}
            >
              Create a new contact
            </button>` : d}
      </div>`;
  })}
  </div>` : d;
}
function qs(t) {
  const { status: e, loadError: n, preview: i, lastSync: s, working: a } = t.google;
  return e ? e.connected ? o`<div class="card" style="padding:13px;display:grid;gap:12px">
    ${n ? o`<div class="muted" id="google-refresh-error" role="status" style="font-size:12.5px">Couldn't refresh Google status</div>` : d}
    ${Ds(e)} ${Gs(t, e)}
    <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn secondary" id="google-preview-btn" ?disabled=${t.busy || a !== null} @click=${() => void t.previewGoogle()}>
        ${a === "preview" ? "Previewing…" : "Preview"}
      </button>
      <button
        class="btn"
        id="google-sync-btn"
        ?disabled=${t.busy || a !== null || !e.enabled}
        @click=${() => void t.syncGoogleNow()}
      >
        ${a === "sync" ? "Syncing…" : "Sync now"}
      </button>
    </div>
    ${i ? Bs(i) : d} ${s ? Fs(s) : d} ${Vs(t)}
  </div>` : zs() : o`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${n ? `Couldn't load the Google sync status: ${n}` : "Loading…"}</div>
    </div>`;
}
function Ks(t) {
  if (t.drafts.get(we))
    return I({
      title: "Turn on Google sync?",
      lines: ["Contacts will be created and updated in your Google account. Hearth never deletes a Google contact."],
      confirmLabel: "Turn on",
      busy: t.busy,
      onCancel: () => t.drafts.drop(we),
      onConfirm: () => {
        t.drafts.drop(we), t.setGoogleEnabled(!0);
      }
    });
  const e = t.drafts.get(_e);
  if (e)
    return I({
      title: "Create a new contact?",
      lines: [
        e.uncertain ? "Hearth couldn't confirm whether Google created this contact. Check Google Contacts for a stray copy first; a new one will be created." : "A new contact will be created in Google. The old one is not touched."
      ],
      confirmLabel: "Create new contact",
      busy: t.busy,
      onCancel: () => t.drafts.drop(_e),
      onConfirm: () => {
        t.drafts.drop(_e), t.clearGoogleContact(e.personId);
      }
    });
}
function ye(t, e, n) {
  return o`<a class="action" href=${n} target="_blank" rel="noopener noreferrer" aria-label=${e} title=${e}
    >${t}</a
  >`;
}
function Ws(t, e) {
  const n = Ps(t.phone), i = Ns(t.phone), s = Is(t.email), a = Os(t, e);
  return o`<div class="actions-row">
    <a class="action primary" href=${p.logInteraction(t.id)} aria-label="Log interaction" title="Log interaction"
      >${b.plus}</a
    >
    ${n ? ye(b.phone, "Call", n) : d} ${i ? ye(b.message, "Message", i) : d}
    ${s ? ye(b.envelope, "Email", s) : d} ${a ? ye(b.mapPin, "Map", a) : d}
  </div>`;
}
function Ys(t, e) {
  const n = e.person;
  return o`<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
    <a class="connection" href=${p.person(n.id)} style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
      ${E(n.name, n.photo_url, 28)}
      <span style="flex:1;font-weight:600;font-size:13px">${n.name}</span>
    </a>
    ${e.connectionType && e.relationshipId ? o`<a
          class="connection-type mono muted"
          style="font-size:9px;padding:6px 0 6px 8px"
          href=${p.relationship(t, e.relationshipId)}
          aria-label=${`Edit relationship with ${n.name}`}
          >${e.connectionType.toUpperCase()}</a
        >` : d}
  </div>`;
}
const zt = o`<div style="border-top:1px solid var(--border);margin:9px 0"></div>`;
function Zs(t) {
  const e = Y(t);
  return o`<a href=${p.household(t.id)} style="display:flex;justify-content:space-between;padding-bottom:2px">
    <span class="mono household-name ${e ? "accent" : "muted"}" style="font-size:9.5px"
      >${e ? H(t).toUpperCase() : H(t)}</span
    >
    <span class="mono muted" style="font-size:9px">HOUSEHOLD</span>
  </a>`;
}
function Js(t, e) {
  const { people: n, households: i, groups: s, relationships: a, me_person_id: r } = e, l = ls(t.id, { people: n, households: i, groups: s, relationships: a, excludedId: r }), c = (u) => Ys(t.id, u), h = o`<a class="accent add-relationship" href=${p.newRelationship(t.id)} style="display:block;font-size:12.5px;padding:8px 20px 18px"
    >Add relationship</a
  >`;
  return os(l) ? o`<div class="label" style="padding:0 20px 8px">Connections</div>${h}` : o`<div class="label" style="padding:0 20px 8px">Connections</div>
    <div class="card">
      ${l.household ? o`${Zs(l.household)} ${l.householdMembers.map(c)}` : d}
      ${l.others.length ? o`${l.household ? o`${zt}<div class="mono muted" style="font-size:9.5px">ELSEWHERE</div>` : d}
          ${l.others.map(c)}` : d}
      ${l.groups.length ? o`${l.household || l.others.length ? zt : d}
            <div class="mono muted" style="font-size:9.5px;padding-bottom:5px">GROUPS</div>
            <div class="chips">
              ${l.groups.map(
    (u) => o`<a class="chip" href=${p.group(u.id)}
                    >${u.name}<span class="mono muted" style="font-size:8.5px">${u.member_ids.length}</span></a
                  >`
  )}
            </div>` : d}
    </div>
    ${h}`;
}
function Xs(t) {
  const n = [
    [ve(t.website), b.globe, "Website"],
    [ve(t.linkedin), b.linkedIn, "LinkedIn profile"],
    [ve(t.facebook), b.facebook, "Facebook profile"],
    [ve(t.instagram), b.instagram, "Instagram profile"]
  ].filter(([i]) => i);
  return n.length ? o`<div style="display:flex;gap:14px;padding:0 20px 18px">
    ${n.map(
    ([i, s, a]) => o`<a class="accent" style="width:22px;height:22px;display:inline-flex" href=${i ?? ""} target="_blank" rel="noopener noreferrer" aria-label=${a} title=${a}
          >${s}</a
        >`
  )}
  </div>` : d;
}
function Qs(t) {
  return t.length ? o`<div class="label" style="padding:0 20px 8px">Timeline</div>
    <div style="display:grid;gap:16px;padding:0 20px 20px">
      ${t.map(
    (e) => o`<a href=${p.interaction(e.id)} style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:11px;height:11px;border:2px solid var(--accent);border-radius:50%;margin-top:3px;flex:none"></span>
          <span>
            <div class="mono muted" style="font-size:9.5px">${Ti(e.date).toUpperCase()} · ${e.type.toUpperCase()}</div>
            <div style="font-weight:600;font-size:13px">${e.summary}</div>
          </span>
        </a>`
  )}
    </div>` : d;
}
function On(t, e, n) {
  const i = $(t), s = i.people.find((c) => c.id === e);
  if (!s) return t.isArriving(e) ? Pe : j("person");
  const a = s.household_id ? i.households.find((c) => c.id === s.household_id) ?? null : null, r = [s.occupation, s.employer].filter(Boolean).join(" - "), l = s.how_i_know_them?.trim();
  return {
    title: null,
    back: !0,
    actions: [
      { icon: b.pencil, label: "Edit", href: p.editPerson(s.id) },
      {
        icon: s.favorite ? b.starFill : b.star,
        label: s.favorite ? "Remove from favorites" : "Add to favorites",
        className: s.favorite ? "accent" : "muted",
        onClick: () => void t.toggleFavorite(s)
      }
    ],
    body: o`<div class="page">
      <div style="display:grid;justify-items:center;gap:6px;padding:8px 20px 18px;text-align:center">
        ${ms(t, { kind: "person", id: s.id, name: s.name, photoUrl: s.photo_url })}
        <div class="h-serif" style="font-size:21px">${s.name}</div>
        ${r ? o`<div class="muted" style="font-size:12.5px">${r}</div>` : d}
        ${l ? o`<div class="muted" style="font-size:12.5px">${l}</div>` : d}
        ${s.birthday ? o`<div class="muted" style="font-size:12.5px">${Ri(s.birthday, s.birth_year_unknown, s.age)}</div>` : d}
        ${s.close_friend ? o`<div class="mono accent" style="font-size:10px;padding:4px 12px;border:1px dashed var(--thread);border-radius:999px;margin-top:4px">
              ◆ Close Friend rotation
            </div>` : d}
      </div>
      ${s.google_sync_error ? o`<a class="notice google-error" href=${p.settings()} style="display:block">Google sync: ${Nn(s.google_sync_error)}</a>` : d}
      ${Ws(s, a)}
      ${s.relationship_summary ? o`<div class="label" style="padding:0 20px 8px">Relationship summary</div>
            <div class="card" style="border-left:3px solid var(--accent);padding:14px;font-size:12.5px;white-space:pre-wrap">${s.relationship_summary}</div>` : d}
      ${Js(s, i)} ${Xs(s)} ${Qs(qi(i.interactions, s.id))}
    </div>`,
    overlay: n === "log" ? gn(t, s, null) : void 0
  };
}
const Je = "new", Ln = [
  "name",
  "how_i_know_them",
  "occupation",
  "employer",
  "phone",
  "phone2",
  "email",
  "email2",
  "website",
  "linkedin",
  "facebook",
  "instagram",
  "notes",
  "relationship_summary"
], ea = ["favorite", "close_friend"], yt = (t) => `edit:person:${t}`, Xe = (t) => `confirm-delete:person:${t}`;
function ta(t, e) {
  return t.groups.filter((n) => n.member_ids.includes(e)).map((n) => n.id);
}
function na(t, e) {
  return {
    ...Object.fromEntries(Ln.map((i) => [i, t[i] ?? ""])),
    favorite: t.favorite,
    close_friend: t.close_friend,
    birthday: t.birthday ?? "",
    birth_year_unknown: t.birth_year_unknown,
    address: t.address?.formatted ?? "",
    school: t.school?.formatted ?? "",
    household_id: t.household_id ?? "",
    group_ids: ta(e, t.id),
    saving: !1
  };
}
function Dt(t, e) {
  const n = {};
  for (const i of Ln) n[i] = t[i];
  for (const i of ea) n[i] = t[i];
  return n.birthday = t.birthday, n.birth_year_unknown = t.birthday !== "" && t.birth_year_unknown, n.address = t.address, n.school = t.school, n.household_id = e, n;
}
function ia(t, e) {
  const n = t.relationships.filter((c) => c.person_a_id === e || c.person_b_id === e).length, i = t.groups.filter((c) => c.member_ids.includes(e)).length, s = t.interactions.filter((c) => c.person_ids.includes(e)), a = s.filter((c) => c.person_ids.every((h) => h === e)).length, r = s.length - a, l = (c, h, u) => `${c} ${c === 1 ? h : u}`;
  return `Also removes ${l(n, "relationship", "relationships")} and ${l(i, "group membership", "group memberships")}. ${l(a, "interaction with only them is", "interactions with only them are")} deleted; ${l(r, "shared interaction keeps", "shared interactions keep")} the other people.`;
}
function sa(t, e) {
  const n = e.household_id ? t.households.find((i) => i.id === e.household_id) : void 0;
  return n ? [`They leave ${ct(n, t.people)}.`] : [];
}
function aa(t, e) {
  const n = Xe(e.id), i = $(t);
  return I({
    title: `Delete ${e.name}?`,
    lines: [ia(i, e.id), ...sa(i, e), "This can't be undone."],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("person", e.id) && (t.drafts.drop(n), t.drafts.drop(yt(e.id)), z(p.home(), !0));
    }
  });
}
async function ra(t, e) {
  const n = yt(e.id), i = t.drafts.get(n), s = t.drafts.base(n);
  if (!(!i || !s || i.saving || !i.name.trim())) {
    t.drafts.patch(n, { saving: !0 });
    try {
      let a = i.household_id || null;
      if (a === Je) {
        const l = await t.save("household", null, {});
        if (!l) return;
        a = l.id, t.drafts.patch(n, { household_id: a });
      }
      const r = Dt(s, s.household_id || null);
      if (!await t.save("person", e.id, Dt(i, a), r)) return;
      for (const l of $(t).groups) {
        const c = i.group_ids.includes(l.id);
        if (s.group_ids.includes(l.id) === c) continue;
        const h = t.groupMembers(l.id);
        if (h.includes(e.id) === c) continue;
        const u = c ? [...h, e.id] : h.filter((f) => f !== e.id);
        if (!await t.setGroupMembers(l.id, u)) return;
      }
      t.drafts.drop(n), F(p.person(e.id));
    } finally {
      t.drafts.patch(n, { saving: !1 });
    }
  }
}
const P = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`;
function oa(t, e) {
  const n = t.households.map((i) => ({ value: i.id, label: ct(i, t.people) })).sort((i, s) => U(i.label, s.label));
  return e && e !== Je && !n.some((i) => i.value === e) && n.push({ value: e, label: "New household" }), [{ value: "", label: "None" }, ...n, { value: Je, label: "New household…" }];
}
function la(t, e, n, i) {
  if (!n.groups.length) return o`<div class="muted" style="font-size:12.5px">No groups yet.</div>`;
  const s = [...n.groups].sort((r, l) => U(r.name, l.name)), a = (r, l) => {
    const c = t.drafts.get(e)?.group_ids ?? [], h = l ? [...c.filter((u) => u !== r), r] : c.filter((u) => u !== r);
    t.drafts.patch(e, { group_ids: h });
  };
  return o`<div role="group" aria-label="Groups">
    ${s.map(
    (r) => o`<label class="check">
        <input
          type="checkbox"
          data-group=${r.id}
          .checked=${k(i.includes(r.id))}
          @change=${(l) => a(r.id, l.target.checked)}
        />
        ${r.name}
      </label>`
  )}
  </div>`;
}
function ca(t, e) {
  const n = $(t), i = n.people.find((f) => f.id === e);
  if (!i) return t.isArriving(e) ? Pe : j("person");
  const s = yt(e), a = p.editPerson(e), r = t.drafts.open(s, a, () => na(i, n)), l = !r.name.trim(), c = de(t, s), h = { ...c, error: (f) => f === "name" && l ? "Enter a name." : c.error(f) }, u = l || r.saving || t.busy;
  return {
    title: "Edit person",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${P("Photo", gt(t, { kind: "person", id: e, name: i.name, photoUrl: i.photo_url }))}
      ${P(
      "Basics",
      o`${M(h, "name", "Name", { required: !0, maxlength: 200 })}
        ${M(h, "how_i_know_them", "How I know them", { maxlength: 2e3 })}
        ${M(h, "occupation", "Occupation", { maxlength: 300 })} ${M(h, "employer", "Employer", { maxlength: 300 })}`
    )}
      ${P(
      "Contact",
      o`${M(h, "phone", "Phone", { type: "tel", autocomplete: "tel", maxlength: 50 })}
        ${M(h, "phone2", "Phone 2", { type: "tel", maxlength: 50 })}
        ${M(h, "email", "Email", { type: "email", autocomplete: "email", maxlength: 500 })}
        ${M(h, "email2", "Email 2", { type: "email", maxlength: 500 })}`
    )}
      ${P("Dates", Xi(h, "birthday", "Birthday", "birth_year_unknown"))}
      ${P(
      "Flags",
      o`${Ke(h, "favorite", "Favorite")} ${Ke(h, "close_friend", "Close friend")}`
    )}
      ${P("Places", o`${qe(h, "address", "Address")} ${qe(h, "school", "School")}`)}
      ${P(
      "Links",
      o`${fe(h, "website", "Website")} ${fe(h, "linkedin", "LinkedIn")} ${fe(h, "facebook", "Facebook")}
        ${fe(h, "instagram", "Instagram")}`
    )}
      ${P(
      "Notes and summary",
      o`${oe(h, "notes", "Notes", 2e4)} ${oe(h, "relationship_summary", "Relationship summary", 2e4)}`
    )}
      ${P("Household", mn(h, "household_id", "Household", oa(n, r.household_id)))}
      ${P("Groups", la(t, s, n, r.group_ids))}
      <button class="btn" ?disabled=${u} @click=${() => void ra(t, i)}>Save</button>
      <button
        class="btn danger"
        style="margin-top:24px"
        ?disabled=${t.busy}
        @click=${() => t.drafts.put(Xe(e), a, {})}
      >
        Delete person
      </button>
    </div>`,
    overlay: t.drafts.get(Xe(e)) ? aa(t, i) : void 0
  };
}
const da = (t, e) => `edit:relationship:${t}:${e ?? "new"}`, Qe = (t) => `confirm-delete:relationship:${t}`;
function ha(t, e, n) {
  const i = On(t, e, null), s = $(t), a = s.people.find((c) => c.id === e);
  if (!a) return i;
  let r, l = null;
  return n !== null && (r = s.relationships.find((c) => c.id === n), l = r ? Ne(r, e) : null, !r || !l) ? i : { ...i, overlay: ua(t, a, r ?? null, l) };
}
function ua(t, e, n, i) {
  const s = $(t), a = n?.id ?? null, r = da(e.id, a), l = n ? p.relationship(e.id, n.id) : p.newRelationship(e.id), c = t.drafts.open(r, l, () => ({
    other: i?.otherId ?? "",
    type: i?.type ?? "",
    notes: n?.notes ?? ""
  })), h = s.people.find((g) => g.id === c.other), u = s.relationships.flatMap((g) => {
    const T = Ne(g, e.id);
    return T && T.otherId !== i?.otherId ? [T.otherId] : [];
  }), f = [{ value: "", label: "Choose…" }, ...s.connection_types.map((g) => ({ value: g, label: g }))];
  c.type && !s.connection_types.includes(c.type) && f.push({ value: c.type, label: c.type });
  const m = () => {
    t.drafts.drop(r), F(p.person(e.id));
  }, _ = !!h && c.type !== "", v = async () => {
    const g = t.drafts.get(r), T = t.drafts.base(r);
    if (!g || !T || !g.other || !g.type) return;
    const jn = g.other !== T.other || g.type !== T.type, bt = { person_a_id: e.id, person_b_id: g.other, type: g.type };
    (await t.save(
      "relationship",
      a,
      { ...bt, notes: g.notes },
      jn ? { notes: T.notes } : { ...bt, notes: T.notes }
    ) || a && !$(t).relationships.some((Vn) => Vn.id === a)) && m();
  }, S = de(t, r), y = Me(e.name);
  return o`<div class="sheet-backdrop" @click=${(g) => g.target === g.currentTarget && m()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit relationship" : "Add relationship"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${m}>Cancel</button>
        <span class="title" style="text-align:center">${n ? "Relationship" : "Add relationship"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!_ || t.busy} @click=${v}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          ${mt(t, {
    id: "relationship-person",
    label: "Person",
    path: l,
    exclude: [e.id, ...u],
    selected: h ? [h.id] : [],
    onPick: (g) => t.drafts.patch(r, { other: g }),
    onRemove: () => t.drafts.patch(r, { other: "" }),
    // Just a name: the rest can be filled in from their own screen later.
    onCreate: async (g) => {
      const T = await t.addPerson(Cn(g));
      T && t.drafts.patch(r, { other: T });
    },
    disabled: t.busy
  })}
          <div class="muted" style="font-size:12.5px">${h ? h.name : "Someone"} is ${y}'s</div>
          ${mn(S, "type", "Type", f)} ${oe(S, "notes", "Notes", 2e4)}
          ${n ? o`<button
                class="btn danger"
                style="margin-top:12px"
                ?disabled=${t.busy}
                @click=${() => t.drafts.put(Qe(n.id), l, {})}
              >
                Remove relationship
              </button>` : d}
        </div>
      </div>
    </div>
  </div>
  ${n && t.drafts.get(Qe(n.id)) ? pa(t, e, s.people.find((g) => g.id === i?.otherId), n, m) : d}`;
}
function pa(t, e, n, i, s) {
  const a = Qe(i.id), r = n?.name ?? "them";
  return I({
    title: `Remove the link between ${e.name} and ${r}?`,
    lines: ["Both people stay in Hearth. Only this relationship is removed. This can't be undone."],
    confirmLabel: "Remove",
    busy: t.busy,
    onCancel: () => t.drafts.drop(a),
    onConfirm: async () => {
      await t.remove("relationship", i.id) && (t.drafts.drop(a), s());
    }
  });
}
function Gt(t, e) {
  const n = t.contact_status, i = e ? "var(--danger)" : "var(--warning)";
  return o`<a class="row" href=${p.person(t.id)}>
    <span style="width:3px;height:36px;border-radius:2px;background:${i};flex:none"></span>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${n.last_contacted ? `Last: ${Ee(n.last_contacted)}` : "No interactions yet"}</div>
    </span>
    <span class="meta" style="color:${i}">${n.days_since_contact === null ? "—" : `${n.days_since_contact}d`}</span>
  </a>`;
}
const Bt = (t, e) => (t.contact_status.days_since_contact ?? 1 / 0) - (e.contact_status.days_since_contact ?? 1 / 0);
function fa(t) {
  const e = $(t).people.filter((s) => s.close_friend), n = e.filter((s) => s.contact_status.urgency === "overdue").sort(Bt), i = e.filter((s) => s.contact_status.urgency === "due_soon").sort(Bt);
  return {
    title: "Reach out",
    back: !1,
    actions: [],
    body: o`<div class="page">
      <div class="reach-card">
        <div class="mono accent" style="font-size:10px">CLOSE FRIEND ROTATION · ~6WK CADENCE</div>
        <div class="h-serif" style="font-size:17px;margin-top:6px">${Re(n.length, "person", "people")} overdue</div>
      </div>
      ${n.length ? o`<div class="label list-label">Overdue</div>
            <div class="list">${n.map((s) => Gt(s, !0))}</div>` : d}
      ${i.length ? o`<div class="label list-label">Due soon</div>
            <div class="list">${i.map((s) => Gt(s, !1))}</div>` : d}
      ${!n.length && !i.length ? o`<div class="empty">Everyone's been in touch recently.</div>` : d}
    </div>`
  };
}
const ma = [
  ["people", "People"],
  ["households", "Households"],
  ["groups", "Groups"]
], Ft = (t, e) => e === "" || t.toLocaleLowerCase().includes(e.toLocaleLowerCase());
function ga(t) {
  const e = H(t);
  return o`<a class="row" href=${p.household(t.id)}>
    ${E(e, t.photo_url)}
    <span class="main"><div class="name ${Y(t) ? "" : "muted"}">${e}</div></span>
    <span class="meta">${Re(t.member_ids.length, "member")}</span>
  </a>`;
}
function va(t) {
  return o`<a class="row" href=${p.group(t.id)}>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      ${t.description ? o`<div class="sub">${t.description}</div>` : d}
    </span>
    <span class="meta">${Re(t.member_ids.length, "member")}</span>
  </a>`;
}
function ya(t) {
  const { people: e, households: n, groups: i, relationships: s } = $(t), a = t.search.text.trim();
  switch (t.search.chip) {
    case "people": {
      const r = ft(a, e, s);
      return o`${r.direct.map((l) => je(l))}
      ${r.connected.length ? o`${Hi("Connected")} ${r.connected.map((l) => je(l.person, l.reason))}` : d}
      ${r.direct.length + r.connected.length === 0 ? o`<div class="empty">No one matches “${a}”.</div>` : d}`;
    }
    case "households":
      return n.map((r) => ({ h: r, name: H(r) })).filter(({ name: r }) => Ft(r, a)).sort((r, l) => U(r.name, l.name)).map(({ h: r }) => ga(r));
    case "groups":
      return i.filter((r) => Ft(r.name, a)).sort((r, l) => U(r.name, l.name)).map(va);
  }
}
function ba(t) {
  if (t === "people") return d;
  const [e, n] = t === "households" ? ["New household", p.newHousehold()] : ["New group", p.newGroup()];
  return o`<div style="padding:0 16px 8px"><a class="btn secondary new-record" style="display:inline-flex;align-items:center" href=${n}>${e}</a></div>`;
}
function $a(t) {
  const { text: e, chip: n } = t.search;
  return {
    title: null,
    back: !1,
    actions: [],
    body: o`<div class="page">
      <div style="padding:10px 16px 0">
        <input
          id="search-field"
          class="input"
          type="search"
          placeholder="Search"
          aria-label="Search"
          autocomplete="off"
          .value=${k(e)}
          @input=${(i) => t.setSearch({ text: i.target.value })}
        />
      </div>
      <div class="pills" style="padding:8px 16px">
        ${ma.map(
      ([i, s]) => o`<button
            class="pill mono ${n === i ? "on" : ""}"
            aria-pressed=${n === i ? "true" : "false"}
            @click=${() => t.setSearch({ chip: i })}
          >
            ${s}
          </button>`
    )}
      </div>
      ${ba(n)}
      <div class="list">${ya(t)}</div>
    </div>`
  };
}
const xa = new URL(import.meta.url).searchParams.get("v"), wa = [
  {
    kind: "birthdays",
    id: "notify-birthdays",
    label: "Birthdays",
    help: "On the day, with their age when it's known. Tapping it opens a text to them."
  },
  {
    kind: "log_reminder",
    id: "notify-log",
    label: "Log reminder",
    help: "A reminder if you haven't logged an interaction today."
  }
];
function _a(t) {
  const { status: e, loadError: n, testing: i } = t.notifications;
  if (!e)
    return o`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${n ? `Couldn't load the notification settings: ${n}` : "Loading…"}</div>
    </div>`;
  const s = e.devices === 0;
  return o`<div class="card" style="padding:13px;display:grid;gap:14px">
    ${s ? o`<div class="muted" id="notify-no-phone" role="status" style="font-size:12.5px">
          No phone is set up for notifications. Install the Home Assistant Companion app and sign in as yourself.
        </div>` : d}
    ${wa.map(({ kind: a, id: r, label: l, help: c }) => {
    const h = e.settings[a];
    return o`<div style="display:grid;gap:6px">
        <label class="check">
          <input
            id=${r}
            type="checkbox"
            role="switch"
            ?disabled=${t.busy}
            .checked=${k(h.enabled)}
            @change=${(u) => void t.setNotification(a, { enabled: u.target.checked })}
          />
          <span>${l}</span>
        </label>
        <div class="muted" style="font-size:12.5px">${c}</div>
        <label class="field">
          <span>Time</span>
          <input
            id=${`${r}-time`}
            class="input"
            type="time"
            step="60"
            ?disabled=${t.busy}
            .value=${k(h.time)}
            @change=${(u) => {
      const f = u.target.value;
      f && t.setNotification(a, { time: f });
    }}
          />
        </label>
      </div>`;
  })}
    <button class="btn secondary" id="notify-test" ?disabled=${t.busy || i || s} @click=${() => void t.sendTestNotification()}>
      ${i ? "Sending…" : "Send a test"}
    </button>
  </div>`;
}
const ka = 8, be = "me-picker";
function Ca(t) {
  const { people: e, relationships: n, me_person_id: i } = $(t), s = i ? e.find((u) => u.id === i) : void 0, a = t.drafts.get(be)?.query ?? null, r = () => t.drafts.drop(be), l = async (u) => {
    await t.setMe(u) && r();
  }, c = o`<div style="display:flex;align-items:center;gap:12px">
    ${s ? o`${E(s.name, s.photo_url, 36)}<span style="flex:1;font-weight:600">${s.name}</span>` : o`<span class="muted" style="flex:1">Not set</span>`}
    ${a === null ? o`<button class="btn secondary" @click=${() => t.drafts.put(be, p.settings(), { query: "" })}>Change</button>
          ${s ? o`<button class="btn secondary" ?disabled=${t.busy} @click=${() => l(null)}>Clear</button>` : d}` : d}
  </div>`;
  if (a === null) return o`<div class="card" style="padding:13px">${c}</div>`;
  const h = ft(a.trim(), e, n).direct.slice(0, ka);
  return o`<div class="card" style="padding:13px;display:grid;gap:10px">
    ${c}
    <input
      id="me-search"
      class="input"
      type="search"
      placeholder="Search people"
      aria-label="Search people"
      autocomplete="off"
      .value=${k(a)}
      @input=${(u) => t.drafts.patch(be, { query: u.target.value })}
    />
    <div class="list">
      ${h.length ? h.map(
    (u) => o`<button class="row me-choice" style="width:100%;text-align:left" ?disabled=${t.busy} @click=${() => l(u.id)}>
              ${E(u.name, u.photo_url)}<span class="main"><div class="name">${u.name}</div></span>
            </button>`
  ) : o`<div class="empty">No one matches “${a.trim()}”.</div>`}
    </div>
    <button class="btn secondary" @click=${r}>Cancel</button>
  </div>`;
}
function Ea(t) {
  switch (t.reason) {
    case "local_changes":
      return "Your Hearth has changes made here since the last import. Importing replaces everything in it.";
    case "cutover_confirmed":
      return "Imports are turned off because this Hearth is now your main copy.";
    case "invalid":
      return "That file can't be imported.";
    case "too_large":
      return "That file is too large to import.";
    case "no_crm":
      return "You don't have a Hearth to import into yet.";
    default:
      return "That file couldn't be read as a Hearth bundle.";
  }
}
const Ae = "confirm-import";
function Aa(t, e) {
  return I({
    title: `Import ${e.name}?`,
    lines: ["Everything in your Hearth is replaced by what's in this file."],
    confirmLabel: "Import",
    busy: t.busy,
    onCancel: () => t.drafts.drop(Ae),
    onConfirm: () => {
      t.drafts.drop(Ae), t.importBundle(e, !1);
    }
  });
}
function Sa(t) {
  const e = t.importState, n = e.kind === "uploading", i = (s) => {
    const a = s.target, r = a.files?.[0];
    a.value = "", r && t.drafts.put(Ae, p.settings(), { file: r });
  };
  return o`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">Replaces everything in your Hearth with a Hearth export (.zip).</div>
    <input
      id="import-file"
      type="file"
      accept=".zip,application/zip"
      aria-label="Choose a Hearth export to import"
      ?disabled=${t.busy}
      @change=${i}
    />
    ${n ? o`<div class="notice" role="status" style="margin:0">Uploading and importing…</div>` : d}
    ${e.kind === "done" ? o`<div class="notice" role="status" style="margin:0">${e.summary}</div>` : d}
    ${e.kind === "refused" ? o`<div role="alert" style="display:grid;gap:8px">
          <div>${Ea(e)}</div>
          ${e.reason === "invalid" && e.problems.length ? o`<ul class="muted" style="margin:0;padding-left:18px;font-size:12.5px">
                ${e.problems.map((s) => o`<li>${s}</li>`)}
              </ul>` : d}
          ${e.reason === "local_changes" ? o`<div class="actions" style="display:flex;gap:8px">
                <button class="btn secondary" ?disabled=${t.busy} @click=${() => t.clearImport()}>Cancel</button>
                <button class="btn danger" ?disabled=${t.busy} @click=${() => void t.importBundle(e.file, !0)}>Replace everything</button>
              </div>` : d}
        </div>` : d}
  </div>`;
}
function Ta(t) {
  const e = t.drafts.get(Ae);
  return {
    overlay: e ? Aa(t, e.file) : Ks(t),
    title: "Settings",
    back: !0,
    actions: [],
    body: o`<div class="page">
      <div class="label" style="padding:16px 20px 8px">This is me</div>
      ${Ca(t)}

      <div class="label" style="padding:0 20px 8px">Notifications</div>
      ${_a(t)}

      <div class="label" style="padding:0 20px 8px">Export</div>
      <div class="card" style="padding:13px;display:grid;gap:10px">
        <div class="muted" style="font-size:12.5px">Saves everything in your Hearth as one file in your Hearth exports folder.</div>
        <button class="btn" ?disabled=${t.busy} @click=${() => void t.exportNow()}>Export now</button>
      </div>

      <div class="label" style="padding:0 20px 8px">Import</div>
      ${Sa(t)}

      <div class="label" style="padding:0 20px 8px">Google Contacts</div>
      ${qs(t)}

      <div class="label" style="padding:0 20px 8px">About</div>
      <div class="card" style="padding:13px">Version ${xa ?? "unknown"}</div>
    </div>`
  };
}
const Ra = "https://claude.ai/new", Ma = "Offline. Showing what was last loaded; changes are paused.";
function Pa(t, e) {
  switch (e.name) {
    case "home":
      return Yi(t);
    case "search":
      return $a(t);
    case "reachOut":
      return fa(t);
    case "add":
      return Ui(t);
    case "birthdays":
      return Zi(t);
    case "interactions":
      return Ji(t);
    case "settings":
      return Ta(t);
    case "person":
      return On(t, e.id, e.sheet);
    case "personEdit":
      return ca(t, e.id);
    case "relationship":
      return ha(t, e.personId, e.relId);
    case "household":
      return Rs(t, e.id);
    case "householdNew":
      return xs(t);
    case "householdEdit":
      return Ts(t, e.id);
    case "group":
      return Ms(t, e.id);
    case "groupNew":
      return gs(t);
    case "groupEdit":
      return bs(t, e.id);
    case "interaction":
      return is(t, e.id, e.sheet);
  }
}
const jt = [
  { tab: "home", href: p.home(), icon: b.home, label: "Home" },
  { tab: "search", href: p.search(), icon: b.search, label: "Search" },
  { tab: "reachOut", href: p.reachOut(), icon: b.bell, label: "Reach out" },
  { tab: "add", href: p.add(), icon: b.plusCircle, label: "Add" }
];
function Na(t) {
  const e = (n) => o`<a href=${n.href} class=${t === n.tab ? "active" : ""} aria-label=${n.label} title=${n.label}
      aria-current=${t === n.tab ? "page" : "false"}>${n.icon}</a>`;
  return o`<nav class="tabbar">
    ${jt.slice(0, 2).map(e)}
    <a href=${Ra} target="_blank" rel="noopener noreferrer" aria-label="Talk to Claude" title="Talk to Claude">${b.mic}</a>
    ${jt.slice(2).map(e)}
  </nav>`;
}
function Un() {
  return o`<button class="icon-btn" aria-label="Menu" title="Menu" @click=${(e) => e.currentTarget.dispatchEvent(new Event("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>${b.menu}</button>`;
}
function zn(t) {
  return t ? o`<div class="toast" role="status">${t}</div>` : d;
}
function Ia(t, e) {
  const n = e.narrow || t.back || t.title || t.actions.length;
  return o`<div class="shell">
    ${n ? o`<header class="topbar">
          ${e.narrow ? Un() : d}
          ${t.back ? o`<button class="icon-btn" aria-label="Back" title="Back" @click=${() => F(p.home())}>
                ${b.back}
              </button>` : d}
          <span class="title">${t.title ?? ""}</span>
          ${t.actions.map(Ii)}
          <button class="icon-btn muted" aria-label="Refresh" title="Refresh" ?disabled=${e.refreshing} @click=${e.onRefresh}>
            ${b.refresh}
          </button>
        </header>` : d}
    <main class="content" id="content">
      ${e.store.offline ? o`<div class="notice" role="status">${Ma}</div>` : d} ${t.body}
    </main>
    ${Na(e.lastTab)} ${t.overlay ?? d} ${zn(e.toast)}
  </div>`;
}
function q(t, e) {
  return o`<div class="shell">
    ${e.narrow ? o`<header class="topbar">${Un()}<span class="title">Hearth</span></header>` : d}
    <main class="content status">${t}</main>
    ${zn(e.toast)}
  </div>`;
}
const Vt = (t) => t.length > 1 ? t.replace(/\/+$/, "") : t;
function Ha(t, e) {
  const n = Vt(t), i = Vt(e);
  return n === i || n.startsWith(`${i}/`);
}
class Oa {
  /** `onChange` is called after every change made by a user action (put, patch, drop). */
  constructor(e = () => {
  }) {
    this.onChange = e, this.entries = /* @__PURE__ */ new Map();
  }
  /**
   * The draft under `key`, started from `init()` when there is none. Screens call this while
   * drawing, so it doesn't call onChange. `path` is the form's path (an `href.*` value).
   */
  open(e, n, i) {
    const s = this.entries.get(e);
    if (s) return s.value;
    const a = i();
    return this.entries.set(e, { path: n, value: a, base: { ...a } }), a;
  }
  /** The values the draft under `key` opened with (or was last put with). */
  base(e) {
    return this.entries.get(e)?.base;
  }
  get(e) {
    return this.entries.get(e)?.value;
  }
  /** Starts or replaces a draft from a user action, such as opening a confirmation. */
  put(e, n, i) {
    this.entries.set(e, { path: n, value: i, base: { ...i } }), this.onChange();
  }
  /** Merges into the stored draft, not a render's copy: several inputs can land before a re-render. */
  patch(e, n) {
    const i = this.entries.get(e);
    i && (this.entries.set(e, { ...i, value: { ...i.value, ...n } }), this.onChange());
  }
  drop(e) {
    this.entries.delete(e) && this.onChange();
  }
  /** The route is now `path`: every draft whose form path it isn't on is dropped. Called before drawing. */
  leaveTo(e) {
    for (const [n, i] of this.entries) Ha(e, i.path) || this.entries.delete(n);
  }
}
const La = {
  person: ["address", "school"],
  household: ["address"]
}, Dn = (t, e) => La[t]?.includes(e) ?? !1;
function Gn(t, e) {
  switch (e) {
    case "person":
      return t.people;
    case "household":
      return t.households;
    case "contact_group":
      return t.groups;
    case "relationship":
      return t.relationships;
    case "interaction":
      return t.interactions;
  }
}
function qt(t, e, n) {
  return Gn(t, e).find((i) => i.id === n);
}
function Ua(t, e) {
  return ["person", "household", "contact_group", "relationship", "interaction"].some((i) => Gn(t, i).some((s) => s.id === e));
}
const et = (t, e) => t === e || typeof t == "object" && typeof e == "object" && JSON.stringify(t) === JSON.stringify(e);
function tt(t, e, n) {
  if (typeof n != "string") return n;
  const i = n.trim();
  return Dn(t, e) ? i ? { formatted: i } : null : i || null;
}
function Kt(t, e) {
  return e ? Object.fromEntries(Object.entries(t).filter(([n, i]) => !(n in e) || !et(i, e[n]))) : t;
}
function Wt(t, e, n) {
  const i = {};
  for (const [s, a] of Object.entries(n)) {
    if (a === void 0) continue;
    const r = e[s] ?? null;
    if (Dn(t, s) && typeof a == "string") {
      const c = (r?.formatted ?? "").trim();
      a.trim() !== c && (i[s] = tt(t, s, a));
      continue;
    }
    if (et(a, r)) continue;
    const l = tt(t, s, a);
    et(l, r) || (i[s] = l);
  }
  return i;
}
function za(t, e) {
  const n = {};
  for (const [i, s] of Object.entries(e)) {
    const a = tt(t, i, s);
    a != null && (n[i] = a);
  }
  return n;
}
const Bn = "You're offline. Changes are paused.", Ge = "Still saving…", nt = "That was already deleted.", Yt = "hearth_crm:snapshot:", Da = 250, Ga = 3500, Zt = [2e3, 5e3, 1e4], Ba = 1e4;
class Fa {
  constructor(e, n, i, s, a) {
    this.api = e, this.conn = n, this.userId = i, this.storage = s, this.onChange = a, this.phase = { kind: "loading" }, this.snapshot = null, this.entryId = null, this.offline = !1, this.lastError = null, this.createError = null, this.creating = !1, this.retrying = !1, this.search = { text: "", chip: "people" }, this.drafts = new Oa(() => this.onChange()), this.busy = !1, this.shrinkingPhoto = !1, this.importState = { kind: "idle" }, this.google = { status: null, loadError: null, preview: null, lastSync: null, working: null }, this.notifications = { status: null, loadError: null, testing: !1 }, this.toast = null, this.writeError = null, this.subscription = null, this.connEpoch = 0, this.timer = null, this.retryTimer = null, this.retryAttempt = 0, this.generation = 0, this.stopped = !1, this.startRun = null, this.retryRun = null, this.toastTimer = null, this.fetchSeq = 0, this.arriving = null, this.pendingMembers = /* @__PURE__ */ new Map(), this.arrivingTimer = null, this.pendingFavorites = /* @__PURE__ */ new Map(), this.onSettings = !1, this.onDisconnected = () => {
      this.connEpoch++, this.subscription = null, this.offline = !0, this.onChange();
    }, this.onReady = () => {
      this.connEpoch++, this.retryAttempt = 0, this.load();
    }, this.onVisibilityChange = () => {
      document.visibilityState !== "visible" || this.offline || !this.snapshot || ja(/* @__PURE__ */ new Date()) !== this.snapshot.today && this.refresh();
    };
  }
  get cacheKey() {
    return `${Yt}${this.userId}`;
  }
  start() {
    return this.startRun ??= this.begin(), this.startRun;
  }
  async begin() {
    this.stopped = !1, this.removeOtherUsersCaches(), this.conn.addEventListener("disconnected", this.onDisconnected), this.conn.addEventListener("ready", this.onReady), document.addEventListener("visibilitychange", this.onVisibilityChange), await this.load();
  }
  stop() {
    this.startRun = null, this.stopped = !0, this.generation++, this.conn.removeEventListener("disconnected", this.onDisconnected), this.conn.removeEventListener("ready", this.onReady), document.removeEventListener("visibilitychange", this.onVisibilityChange), this.timer && clearTimeout(this.timer), this.timer = null, this.toastTimer && clearTimeout(this.toastTimer), this.toastTimer = null, this.stopArriving(), this.clearRetry(), this.dropSubscription();
  }
  /**
   * Create this user's CRM. A failure keeps the create screen up, with the reason in createError.
   * `creating` stays true through the follow-up load, so the button can't be pressed twice.
   */
  async createCrm() {
    if (!this.creating) {
      this.creating = !0, this.createError = null, this.onChange();
      try {
        await this.api.createCrm(), await this.load();
      } catch (e) {
        this.createError = L(e);
      } finally {
        this.creating = !1, this.onChange();
      }
    }
  }
  /** Load again from the start (status, subscribe, snapshot), as the error screen's Retry does. */
  retry() {
    return this.retryRun ? this.retryRun : (this.retryAttempt = 0, this.retrying = !0, this.onChange(), this.retryRun = this.load().finally(() => {
      this.retryRun = null, this.retrying = !1, this.onChange();
    }), this.retryRun);
  }
  setSearch(e) {
    this.search = { ...this.search, ...e }, this.onChange();
  }
  /**
   * The panel's route is now `path` (the full path, starting /hearth). Drafts for forms it has
   * left are dropped, and so is the last write's error. Called before drawing; no onChange.
   */
  routeChanged(e) {
    this.drafts.leaveTo(e), this.writeError = null, this.onSettings = e === `${x}/settings`, this.onSettings && this.phase.kind === "ready" && (this.loadGoogle(), this.loadNotifications()), this.importState.kind === "refused" && e !== `${x}/settings` && (this.importState = { kind: "idle" });
  }
  showToast(e) {
    this.toastTimer && clearTimeout(this.toastTimer), this.toast = e, this.onChange(), this.toastTimer = setTimeout(() => {
      this.toastTimer = null, this.toast = null, this.onChange();
    }, Ga);
  }
  // ---- Writes ----
  // Each waits for the server, then relies on the subscription's change notice to re-fetch the
  // snapshot. Only favorite is patched in by hand, so the star flips at once.
  /** Optimistic, like Thread's star: flips now, rolls back if the save fails. */
  async toggleFavorite(e) {
    if (this.refuseOffline()) return;
    const n = !e.favorite;
    this.pendingFavorites.set(e.id, n), this.patchFavorite(e.id, n), this.onChange();
    try {
      await this.api.update("person", e.id, { favorite: n }), this.pendingFavorites.delete(e.id);
    } catch (i) {
      this.pendingFavorites.delete(e.id), this.patchFavorite(e.id, e.favorite), this.showToast($e(i));
    }
  }
  async addInteraction(e) {
    const { person_ids: n, type: i, date: s, summary: a, notes: r } = e;
    return await this.write(() => this.api.create("interaction", { person_ids: n, type: i, date: s, summary: a, notes: r })) !== null;
  }
  /**
   * Changes the interaction's own fields only, so the people on a shared one are kept. Only the
   * fields that differ from `base` (what the sheet opened with) and from the snapshot are sent, so
   * an imported summary over the edit limit doesn't block changing just the date. One deleted
   * elsewhere counts as done (with the deleted toast), so its sheet closes.
   */
  async updateInteraction(e, n, i) {
    const { type: s, date: a, summary: r, notes: l } = n, c = Kt({ type: s, date: a, summary: r, notes: l }, i ? { ...i } : void 0), h = this.snapshot ? qt(this.snapshot, "interaction", e) : void 0, u = h ? Wt("interaction", h, c) : c;
    if (!Object.keys(u).length) return !0;
    const f = () => this.api.update("interaction", e, u);
    return await this.write(f, { ifGone: () => {
    } }) !== null;
  }
  deleteInteraction(e) {
    return this.remove("interaction", e);
  }
  /** Saves a new person and resolves to their id (null if it failed). See `save` for arriving. */
  async addPerson(e) {
    const n = { name: e.name, phone: e.phone, email: e.email, how_i_know_them: e.how_i_know_them };
    return e.household_id && (n.household_id = e.household_id), e.birthday?.trim() && (n.birthday = e.birthday, e.birth_year_unknown && (n.birth_year_unknown = !0)), (await this.save("person", null, n))?.id ?? null;
  }
  /**
   * Creates (id null) or updates a record from a form's fields; see storeWrites.ts for what is
   * sent. Resolves to the record's id, or null when refused or failed (with a toast).
   *
   * A new record's id is "arriving" until a snapshot fetched after the save lands, or for at
   * most ARRIVING_MS, so its screen can wait for it.
   *
   * Updating a record that was deleted elsewhere (gone from the snapshot, or `not_found` from the
   * server) toasts "That was already deleted." and resolves to null once the snapshot no longer
   * has it, so the form's screen redraws as "no longer exists".
   *
   * `base` is what an edit form opened with: only fields that differ from it are considered, so a
   * change made elsewhere while the form was open isn't reverted (see storeWrites.editedFields).
   */
  async save(e, n, i, s) {
    if (n === null) {
      const c = await this.write(() => this.api.create(e, za(e, i)));
      return c ? (this.markArriving(c.value.id), { id: c.value.id }) : null;
    }
    const a = this.snapshot ? qt(this.snapshot, e, n) : void 0;
    if (!a)
      return this.refuseOffline() || this.showToast(nt), null;
    const r = Wt(e, a, Kt(i, s));
    return Object.keys(r).length ? (await this.write(async () => (await this.api.update(e, n, r), !0), { ifGone: () => !1 }))?.value ? { id: n } : null : { id: n };
  }
  /** Deletes a record. One already deleted elsewhere counts as done, with the deleted toast. */
  async remove(e, n) {
    return await this.write(() => this.api.remove(e, n), { ifGone: () => {
    } }) !== null;
  }
  /** `base64` is the shrunk photo (forms/photoPicker.ts). */
  async setPhoto(e, n, i) {
    return await this.write(() => this.api.setPhoto(e, n, i)) !== null;
  }
  async clearPhoto(e, n) {
    return await this.write(() => this.api.clearPhoto(e, n)) !== null;
  }
  /**
   * Replaces the group's members with exactly `personIds`. A group deleted elsewhere gets the
   * deleted toast and a refetch, and resolves to false.
   *
   * The list sent is kept as the group's members (see `groupMembers`) until a snapshot catches up,
   * so a second change made before then builds on this one instead of undoing it.
   */
  async setGroupMembers(e, n) {
    const i = await this.write(async () => (await this.api.setGroupMembers(e, n), !0), {
      ifGone: () => !1
    });
    return i ? i.value ? (this.pendingMembers.set(e, { ids: [...n], afterSeq: this.fetchSeq }), this.snapshot && (this.snapshot = this.withPendingMembers(this.snapshot)), this.onChange(), !0) : (this.pendingMembers.delete(e), !1) : !1;
  }
  /** The group's members to build a membership write on: the last list sent, until a snapshot has it. */
  groupMembers(e) {
    const n = this.pendingMembers.get(e);
    return n ? [...n.ids] : [...this.snapshot?.groups.find((i) => i.id === e)?.member_ids ?? []];
  }
  withPendingMembers(e) {
    return this.pendingMembers.size ? {
      ...e,
      groups: e.groups.map((n) => {
        const i = this.pendingMembers.get(n.id);
        return i ? { ...n, member_ids: [...i.ids] } : n;
      })
    } : e;
  }
  /** Pending member lists end once a snapshot has them, or a fetch started after the write lands. */
  settlePendingMembers(e, n) {
    const i = (s, a) => s.length === a.length && s.every((r) => a.includes(r));
    for (const [s, a] of this.pendingMembers) {
      const r = e.groups.find((l) => l.id === s);
      (n > a.afterSeq || !r || i(r.member_ids, a.ids)) && this.pendingMembers.delete(s);
    }
  }
  setShrinkingPhoto(e) {
    this.shrinkingPhoto = e, this.onChange();
  }
  /** True for a record just created that isn't in the snapshot yet. */
  isArriving(e) {
    return this.arriving?.id === e;
  }
  markArriving(e) {
    this.stopArriving(), this.arriving = { id: e, afterSeq: this.fetchSeq }, this.arrivingTimer = setTimeout(() => {
      this.arrivingTimer = null, this.arriving?.id === e && (this.arriving = null, this.onChange());
    }, Ba), this.onChange();
  }
  stopArriving() {
    this.arrivingTimer && clearTimeout(this.arrivingTimer), this.arrivingTimer = null, this.arriving = null;
  }
  /** Who "this is me" is; null clears it. */
  async setMe(e) {
    return await this.write(() => this.api.settingsSet(e)) !== null;
  }
  /** Writes an export bundle on the server and says where it went. */
  async exportNow() {
    const e = this.entryId;
    if (!e) return !1;
    const n = await this.write(() => this.api.exportBundle(e), { failure: "Couldn't export" });
    if (!n) return !1;
    const { path: i } = n.value, s = i.split(/[\\/]/).pop() || i;
    return this.showToast(`Saved ${s} to your Hearth exports folder.`), !0;
  }
  /**
   * Uploads a bundle into this user's Hearth. The result is in `importState`: the summary, or a
   * refusal the Settings card explains. A backup in progress is a toast, like any write; the
   * snapshot refetches by itself from the server's change notice.
   */
  async importBundle(e, n) {
    if (this.refuseOffline()) return !1;
    if (this.busy)
      return this.showToast(Ge), !1;
    this.busy = !0, this.importState = { kind: "uploading" }, this.onChange();
    try {
      const i = await this.api.importBundle(e, n);
      return this.importState = { kind: "done", summary: i.summary }, !0;
    } catch (i) {
      const s = i instanceof A ? i : null, a = s?.code ?? "unknown_error";
      return a === "local_changes" || a === "cutover_confirmed" || a === "invalid" || a === "too_large" || a === "bad_request" || a === "no_crm" ? this.importState = { kind: "refused", reason: a, message: s?.message ?? a, problems: s?.problems ?? [], file: e } : (this.importState = { kind: "idle" }, this.showToast($e(i, "Couldn't import"))), !1;
    } finally {
      this.busy = !1, this.onChange();
    }
  }
  clearImport() {
    this.importState = { kind: "idle" }, this.onChange();
  }
  // ---- Notifications ----
  /** Reloads the notification settings. Quiet when offline; a failure shows in the card. */
  async loadNotifications() {
    if (this.offline) return;
    const e = this.generation;
    try {
      const n = await this.api.notificationsGet();
      if (e !== this.generation) return;
      this.notifications = { ...this.notifications, status: n, loadError: null };
    } catch (n) {
      if (e !== this.generation) return;
      n instanceof A && n.code === "offline" ? this.offline = !0 : this.notifications = { ...this.notifications, loadError: L(n) };
    }
    this.onChange();
  }
  /** Changes one notification's switch or time; the server answers with the new settings. */
  async setNotification(e, n) {
    const i = await this.write(() => this.api.notificationsSet({ [e]: n }), { failure: "Couldn't change the notification" });
    return i ? (this.notifications = { ...this.notifications, status: i.value, loadError: null }, this.onChange(), !0) : !1;
  }
  /** Sends a sample notification to the owner's phone. A refusal (no phone) shows as a toast. */
  async sendTestNotification() {
    if (this.notifications.testing) return;
    this.notifications = { ...this.notifications, testing: !0 }, this.onChange();
    const e = await this.write(() => this.api.notificationsTest(), { failure: "Couldn't send the test" });
    this.notifications = { ...this.notifications, testing: !1 }, e && this.showToast(e.value.sent > 0 ? "Test sent. Check your phone." : "The test could not be delivered."), this.onChange();
  }
  // ---- Google Contacts sync ----
  /** Reloads the sync's status. Quiet when offline; a failure shows in the card, not a toast. */
  async loadGoogle() {
    if (this.offline) return;
    const e = this.generation;
    try {
      const n = await this.api.googleStatus();
      if (e !== this.generation) return;
      this.google = { ...this.google, status: n, loadError: null };
    } catch (n) {
      if (e !== this.generation) return;
      n instanceof A && n.code === "offline" ? this.offline = !0 : this.google = { ...this.google, loadError: L(n) };
    }
    this.onChange();
  }
  /** Switches the sync on or off. Refused before cutover, with the server's reason as a toast. */
  async setGoogleEnabled(e) {
    return await this.write(() => this.api.googleSetEnabled(e), { failure: "Couldn't change the Google sync" }) ? (await this.loadGoogle(), !0) : !1;
  }
  /** Counts what a sync would do, without calling Google or writing anything. */
  previewGoogle() {
    return this.runGoogle("preview", () => this.api.googlePreview(), "Couldn't preview");
  }
  /** Runs a sync and keeps its report. The server may take a while, so this doesn't hold `busy`. */
  syncGoogleNow() {
    return this.runGoogle("sync", () => this.api.googleSyncNow(), "Couldn't sync");
  }
  async runGoogle(e, n, i) {
    if (this.refuseOffline()) return !1;
    if (this.busy || this.google.working)
      return this.showToast(Ge), !1;
    this.google = { ...this.google, working: e }, this.onChange();
    const s = this.generation;
    let a = null;
    try {
      a = await n();
    } catch (r) {
      if (s !== this.generation) return !1;
      this.showToast($e(r, i));
    }
    return s !== this.generation || (this.google = e === "preview" ? { ...this.google, working: null, preview: a ?? this.google.preview } : { ...this.google, working: null, lastSync: a ?? this.google.lastSync, preview: a ? null : this.google.preview }, this.onChange(), await this.loadGoogle()), a !== null;
  }
  /** Forgets a person's Google link so the next run creates a new contact. */
  async clearGoogleContact(e) {
    return await this.write(() => this.api.googleClearContact(e), { ifGone: () => {
    } }) ? (await this.loadGoogle(), !0) : !1;
  }
  refuseOffline() {
    return this.offline ? (this.showToast(Bn), !0) : !1;
  }
  /** Runs one write at a time. Resolves to null, with a toast, when refused or failed. */
  async write(e, n = {}) {
    if (this.refuseOffline()) return null;
    if (this.busy)
      return this.showToast(Ge), null;
    this.busy = !0, this.writeError = null, this.onChange();
    try {
      return { value: await e() };
    } catch (i) {
      const s = i instanceof A ? i : null;
      return n.ifGone && s?.code === "not_found" ? (this.showToast(nt), await this.refresh(), { value: n.ifGone() }) : (this.writeError = s, this.showToast($e(i, n.failure)), null);
    } finally {
      this.busy = !1, this.onChange();
    }
  }
  patchFavorite(e, n) {
    this.snapshot && (this.snapshot = {
      ...this.snapshot,
      people: this.snapshot.people.map((i) => i.id === e ? { ...i, favorite: n } : i)
    });
  }
  /** Re-fetch the snapshot now. Failures keep the data already shown. */
  async refresh() {
    const e = this.generation;
    try {
      const n = ++this.fetchSeq, i = await this.api.snapshot();
      if (e !== this.generation) return;
      this.accept(i, n);
    } catch (n) {
      if (e !== this.generation) return;
      const i = n instanceof A ? n : null;
      if (i?.code === "offline")
        this.offline = !0;
      else if (i?.code === "no_crm" || i?.code === "crm_not_loaded") {
        await this.load();
        return;
      } else {
        this.lastError = i ?? new A("unknown_error", L(n)), this.showToast(`Couldn't refresh: ${this.lastError.message}`);
        return;
      }
    }
    this.onChange();
  }
  /** Status, then subscribe and snapshot. Used for the first load and after every reconnect. */
  async load() {
    const e = ++this.generation;
    this.clearRetry(), this.google.working && (this.google = { ...this.google, working: null });
    try {
      const n = await this.api.status();
      if (e !== this.generation) return;
      if (this.entryId = n.entry_id, !n.has_crm)
        return this.removeCache(), this.show({ kind: "noCrm" });
      if (!n.loaded) {
        if (this.snapshot || (this.snapshot = this.readCache()), this.snapshot) return this.keepAndRetry();
        this.show({ kind: "notLoaded" }), this.scheduleRetry();
        return;
      }
      await this.dropSubscription();
      const i = this.connEpoch, s = await this.api.subscribe((l) => this.onNotice(l));
      if (e !== this.generation) {
        i === this.connEpoch && s().catch(() => {
        });
        return;
      }
      this.subscription = { unsubscribe: s, epoch: i };
      const a = ++this.fetchSeq, r = await this.api.snapshot();
      if (e !== this.generation) return;
      this.accept(r, a), this.phase = { kind: "ready" }, this.retryAttempt = 0, this.onChange(), this.onSettings && (this.loadGoogle(), this.loadNotifications());
    } catch (n) {
      if (e !== this.generation) return;
      this.fail(n);
    }
  }
  show(e) {
    this.phase = e, this.snapshot = null, this.offline = !1, this.onChange();
  }
  fail(e) {
    this.snapshot || (this.snapshot = this.readCache()), this.snapshot ? (this.offline = !0, this.phase = { kind: "ready" }, this.scheduleRetry()) : this.phase = { kind: "error", message: L(e) }, this.onChange();
  }
  keepAndRetry() {
    this.offline = !0, this.phase = { kind: "ready" }, this.scheduleRetry(), this.onChange();
  }
  scheduleRetry() {
    if (this.stopped) return;
    this.clearRetry();
    const e = Zt[Math.min(this.retryAttempt, Zt.length - 1)];
    this.retryAttempt++, this.retryTimer = setTimeout(() => {
      this.retryTimer = null, this.load();
    }, e);
  }
  clearRetry() {
    this.retryTimer && clearTimeout(this.retryTimer), this.retryTimer = null;
  }
  /** `seq` is the fetch's number from fetchSeq, taken when the request started. */
  accept(e, n) {
    const i = this.arriving;
    i && (n > i.afterSeq || Ua(e, i.id)) && this.stopArriving();
    const s = this.pendingFavorites.size ? {
      ...e,
      people: e.people.map(
        (a) => this.pendingFavorites.has(a.id) ? { ...a, favorite: this.pendingFavorites.get(a.id) } : a
      )
    } : e;
    this.settlePendingMembers(e, n), this.snapshot = this.withPendingMembers(s), this.offline = !1, this.lastError = null;
    try {
      this.storage?.setItem(this.cacheKey, JSON.stringify(e));
    } catch {
    }
  }
  /**
   * On a shared browser, one user's CRM must not stay readable after another signs in, so only
   * the current user's copy is kept.
   */
  removeOtherUsersCaches() {
    try {
      const e = this.storage;
      if (!e) return;
      const n = [];
      for (let i = 0; i < e.length; i++) {
        const s = e.key(i);
        s?.startsWith(Yt) && s !== this.cacheKey && n.push(s);
      }
      for (const i of n) e.removeItem(i);
    } catch {
    }
  }
  removeCache() {
    try {
      this.storage?.removeItem(this.cacheKey);
    } catch {
    }
  }
  readCache() {
    try {
      const e = this.storage?.getItem(this.cacheKey);
      if (!e) return null;
      const n = JSON.parse(e);
      return Array.isArray(n?.people) ? n : null;
    } catch {
      return null;
    }
  }
  /** Every notice refetches the snapshot; one from the Google sync also reloads its status. */
  onNotice(e) {
    this.scheduleRefresh(), e?.entity === "google" && this.google.status && this.loadGoogle(), e?.entity === "notifications" && this.notifications.status && this.loadNotifications();
  }
  scheduleRefresh() {
    this.stopped || (this.timer && clearTimeout(this.timer), this.timer = setTimeout(() => {
      this.timer = null, this.refresh();
    }, Da));
  }
  async dropSubscription() {
    const e = this.subscription;
    if (this.subscription = null, !(!e || e.epoch !== this.connEpoch))
      try {
        await e.unsubscribe();
      } catch {
      }
  }
}
function ja(t) {
  const e = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${e(t.getMonth() + 1)}-${e(t.getDate())}`;
}
function $e(t, e = "Couldn't save") {
  switch (t instanceof A ? t.code : null) {
    case "offline":
      return Bn;
    case "backup_in_progress":
      return "Home Assistant is making a backup. Try again in a moment.";
    case "invalid":
      return L(t);
    case "not_found":
      return nt;
    case "import_failed":
    case "cutover_not_confirmed":
    case "sync_refused":
    case "sync_failed":
    case "not_blocked":
    case "no_phone":
      return L(t);
    default:
      return `${e}: ${L(t)}`;
  }
}
function L(t) {
  return t instanceof Error ? t.message : String(t);
}
const Va = ':host{--bg: var(--primary-background-color, #fafafa);--surface: var(--card-background-color, var(--ha-card-background, #ffffff));--text: var(--primary-text-color, #212121);--text-2: var(--secondary-text-color, #727272);--border: var(--divider-color, rgba(0, 0, 0, .12));--accent: var(--primary-color, #03a9f4);--on-accent: var(--text-primary-color, #ffffff);--accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);--hover: color-mix(in srgb, var(--text) 6%, transparent);--thread: var(--divider-color, rgba(0, 0, 0, .12));--danger: var(--error-color, #db4437);--warning: var(--warning-color, #ffa600);--scrim: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, .32));--sans: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif));--serif: var(--sans);--mono: var(--ha-font-family-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace);--tabbar: 56px;position:relative;display:flex;flex-direction:column;height:100dvh;box-sizing:border-box;padding:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) var(--safe-area-content-inset-right, var(--safe-area-inset-right, env(safe-area-inset-right, 0px))) 0 var(--safe-area-content-inset-left, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));background:var(--bg);color:var(--text);font:14px/1.4 var(--sans);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}*{box-sizing:border-box}button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}a{color:inherit;text-decoration:none}input,textarea{font:inherit;color:var(--text)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.shell{display:flex;flex-direction:column;flex:1;min-height:0}.topbar{display:flex;align-items:center;gap:4px;min-height:48px;padding:0 8px;border-bottom:1px solid var(--border);background:var(--bg);flex:none}.topbar .title{flex:1;font:600 16px var(--serif);padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.icon-btn{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border-radius:10px;color:var(--text)}.icon-btn:hover{background:var(--hover)}.icon-btn.accent{color:var(--accent)}.icon-btn.muted{color:var(--text-2)}.icon-btn[disabled]{opacity:.4;cursor:default}.icon-btn svg{width:20px;height:20px}.content{flex:1;overflow-y:auto;overscroll-behavior:contain;padding-bottom:24px;position:relative}.content.status{padding-bottom:calc(24px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.page{max-width:640px;margin:0 auto}.tabbar{flex:none;display:flex;height:calc(var(--tabbar) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));padding-bottom:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));border-top:1px solid var(--border);background:var(--bg)}.tabbar a,.tabbar button{flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-2)}.tabbar .active{color:var(--accent)}.tabbar svg{width:22px;height:22px}.h-serif{font-family:var(--serif);font-weight:600}.mono{font-family:var(--mono)}.label{font:500 10.5px var(--mono);color:var(--text-2);letter-spacing:.02em;text-transform:uppercase}.muted{color:var(--text-2)}.accent{color:var(--accent)}.danger{color:var(--danger)}.warning{color:var(--warning)}.section{margin:16px 0 0}.section-head{display:flex;align-items:baseline;justify-content:space-between;padding:0 16px 6px}.section-head h2{margin:0;font:600 17px var(--serif)}.section-head a,.section-head button{font:600 12px var(--sans);color:var(--accent)}.list{background:var(--surface)}.row{display:flex;align-items:center;gap:12px;padding:8px 16px;min-height:56px;border-bottom:1px solid var(--border);width:100%;text-align:left}.row:last-child{border-bottom:0}.row:hover{background:var(--hover)}.row .main{flex:1;min-width:0}.row .name{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .sub{font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .meta{font:500 10.5px var(--mono);color:var(--text-2);flex:none}.row .star{color:var(--accent);display:inline-block;width:10px;height:10px;margin-left:6px;vertical-align:1px}svg{display:block;width:100%;height:100%}.list-label{padding:10px 16px 4px}.empty{padding:24px 16px;color:var(--text-2);text-align:center}.avatar{flex:none;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-family:var(--serif);font-weight:600;position:relative}.avatar img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}.avatar img.broken{display:none}.stack{display:inline-flex;flex:none}.stack .avatar{box-shadow:0 0 0 2px var(--surface)}.card{background:var(--surface);border-radius:14px;margin:0 16px 18px;padding:10px 13px}.reach-card{margin:16px;padding:16px;border-radius:16px;background:var(--surface);border:1px solid var(--border)}.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--thread);border-radius:999px;font-size:10.5px;color:var(--accent)}.chips{display:flex;flex-wrap:wrap;gap:6px}.pills{display:flex;gap:7px;overflow-x:auto;padding:4px 0}.pill{flex:none;min-height:36px;padding:6px 14px;border-radius:999px;background:var(--surface);color:var(--text-2);font:500 11.5px var(--sans)}.pill.on{background:var(--accent);color:var(--on-accent)}.pill.mono{font:500 11px var(--mono)}.pill.mono.on{background:var(--text);color:var(--bg)}.form{padding:8px 16px;display:grid;gap:16px}.field{display:grid;gap:6px}.field>span{font:500 10.5px var(--mono);color:var(--text-2);text-transform:uppercase}.input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 12px;font-size:15px}.input:focus{border-color:var(--accent);outline:none}textarea.input{min-height:110px;resize:vertical}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px;accent-color:var(--accent)}.btn{min-height:44px;padding:0 18px;border-radius:12px;background:var(--accent);color:var(--on-accent);font-weight:600}.btn[disabled]{opacity:.4;cursor:default}.btn.danger{background:var(--danger);color:var(--on-accent)}.btn.secondary{background:var(--surface);color:var(--text);border:1px solid var(--thread)}.highlight .input{border-color:var(--warning);box-shadow:0 0 0 1px var(--warning)}.field-error{color:var(--danger);font-size:12px}.input[aria-invalid=true]{border-color:var(--danger)}select.input{appearance:auto}.chip-remove{margin-left:2px;min-width:24px;min-height:24px;color:var(--text-2);font-size:14px}.person-picker .chip{color:var(--text)}.photo-picker{display:grid;justify-items:center;gap:10px;padding:8px 0}.photo-picker .actions{display:flex;gap:8px}.file-btn{display:inline-flex;align-items:center;cursor:pointer;position:relative}.file-btn[aria-disabled=true]{opacity:.4;cursor:default}.file-btn:focus-within{outline:2px solid var(--accent);outline-offset:2px}.photo-tap{border-radius:50%}.file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.banner{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--danger);color:var(--on-accent);font:500 11px var(--mono)}.notice{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--accent-soft);color:var(--text);font:500 11px var(--mono)}.center{min-height:60vh;display:grid;place-items:center;text-align:center;padding:24px}.spinner{width:22px;height:22px;border:2px solid var(--thread);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px}@keyframes spin{to{transform:rotate(360deg)}}.sheet-backdrop{position:absolute;inset:0;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10}.sheet{background:var(--bg);width:100%;max-width:640px;max-height:100%;border-radius:16px;display:flex;flex-direction:column;overflow:hidden}.sheet .sheet-body{overflow-y:auto;padding-bottom:calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.dialog{background:var(--surface);border-radius:16px;padding:20px;margin:auto 16px;max-width:360px;width:100%;display:grid;gap:14px;text-align:center}.dialog .actions{display:flex;gap:8px;justify-content:center}.toast{position:absolute;left:50%;transform:translate(-50%);bottom:calc(var(--tabbar) + 16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));background:var(--surface);color:var(--text);border:1px solid var(--border);padding:10px 16px;border-radius:12px;z-index:20;font-size:13px;box-shadow:0 2px 8px var(--scrim)}.actions-row{display:flex;gap:8px;padding:0 20px 18px}.action{width:54px;height:38px;border-radius:12px;background:var(--surface);color:var(--text);display:inline-flex;align-items:center;justify-content:center}.action svg{width:17px;height:17px}.action.primary{background:var(--accent);color:var(--on-accent)}';
function Jt() {
  return o`<div class="center"><div class="spinner" role="progressbar" aria-label="Loading"></div></div>`;
}
function qa(t) {
  return o`<div class="center">
    <div style="max-width:420px">
      <div class="h-serif" style="font-size:21px;margin-bottom:12px">Start your Hearth</div>
      <p class="muted">Your Hearth is private to you: other people on this Home Assistant get their own.</p>
      <button class="btn" ?disabled=${t.creating} aria-busy=${t.creating ? "true" : "false"} @click=${() => void t.createCrm()}>
        ${t.creating ? "Creating…" : "Create my Hearth"}
      </button>
      ${t.createError ? o`<p class="danger" role="alert">${t.createError}</p>` : d}
    </div>
  </div>`;
}
function Ka(t) {
  return o`<div class="center">
    <div style="max-width:420px">
      <p>Your Hearth didn't load. Check Settings → Devices &amp; services → Hearth.</p>
      ${Fn(t)}
    </div>
  </div>`;
}
function Fn(t) {
  return o`<button class="btn" ?disabled=${t.retrying} aria-busy=${t.retrying ? "true" : "false"} @click=${() => void t.retry()}>
    ${t.retrying ? "Retrying…" : "Retry"}
  </button>`;
}
function Wa(t, e) {
  return o`<div class="center">
    <div style="max-width:420px">
      <p>${e}</p>
      ${Fn(t)}
    </div>
  </div>`;
}
function Ya(t) {
  const e = t instanceof Error ? `${t.name}: ${t.message}` : String(t);
  return o`<div class="center">
    <div style="max-width:460px">
      <div class="h-serif" style="font-size:19px;margin-bottom:12px">Hearth hit a problem</div>
      <pre class="mono danger" style="white-space:pre-wrap;font-size:11px;text-align:left">${e}</pre>
      <button class="btn" @click=${() => location.reload()}>Reload</button>
    </div>
  </div>`;
}
var Za = Object.defineProperty, ue = (t, e, n, i) => {
  for (var s = void 0, a = t.length - 1, r; a >= 0; a--)
    (r = t[a]) && (s = r(e, n, s) || s);
  return s && Za(e, n, s), s;
};
function Ja(t, e) {
  return t?.user?.id !== e?.user?.id || t?.connection !== e?.connection;
}
function Xa(t, e) {
  return t?.path !== e?.path || t?.prefix !== e?.prefix;
}
function Qa() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
class X extends ne {
  constructor() {
    super(...arguments), this.narrow = !1, this.refreshing = !1, this.store = null, this.storeUserId = null, this.lastTab = "home", this.scrollPositions = /* @__PURE__ */ new Map(), this.onRefresh = async () => {
      if (!(!this.store || this.refreshing)) {
        this.refreshing = !0;
        try {
          await this.store.refresh();
        } finally {
          this.refreshing = !1;
        }
      }
    }, this.onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const n = e.composedPath().find((s) => s.localName === "a");
      if (!n || n.hasAttribute("target") || n.hasAttribute("download")) return;
      const i = n.getAttribute("href");
      !i || !xi(i) || (e.preventDefault(), i !== `${location.pathname}${location.search}` && z(i));
    };
  }
  static {
    this.styles = Qt(Va);
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return e.addEventListener("click", this.onClick), e;
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.dropStore();
  }
  get currentRoute() {
    return bi(this.route?.path ?? "");
  }
  willUpdate(e) {
    if (this.syncStore(), e.has("route")) {
      const n = e.get("route"), i = this.renderRoot.querySelector("#content");
      n && i && this.scrollPositions.set(n.path, i.scrollTop), this.lastTab = wi(this.currentRoute) ?? this.lastTab, this.store?.routeChanged(`${x}${this.route?.path ?? ""}`);
    }
  }
  updated(e) {
    if (!e.has("route") || !e.get("route")) return;
    const n = this.renderRoot.querySelector("#content");
    n && (n.scrollTop = this.scrollPositions.get(this.route?.path ?? "") ?? 0), this.currentRoute.name === "search" && this.renderRoot.querySelector("#search-field")?.focus();
  }
  /** One store per HA user, built from hass.user.id, so one user's data never shows for another. */
  syncStore() {
    const e = this.isConnected ? this.hass?.user?.id ?? null : null;
    if (e === this.storeUserId || (this.dropStore(), !e || !this.hass)) return;
    const n = new Fa(
      new yi(this.hass.connection, () => this.hass?.auth),
      this.hass.connection,
      e,
      Qa(),
      () => this.onStoreChange(n)
    );
    this.store = n, this.storeUserId = e, n.start();
  }
  dropStore() {
    this.store?.stop(), this.store = null, this.storeUserId = null;
  }
  onStoreChange(e) {
    e === this.store && this.requestUpdate();
  }
  render() {
    const e = this.store, n = { narrow: this.narrow, toast: e?.toast ?? null };
    if (!e) return q(Jt(), n);
    try {
      const i = e.phase;
      switch (i.kind) {
        case "loading":
          return q(Jt(), n);
        case "noCrm":
          return q(qa(e), n);
        case "notLoaded":
          return q(Ka(e), n);
        case "error":
          return q(Wa(e, i.message), n);
        case "ready": {
          const s = { ...n, store: e, lastTab: this.lastTab, refreshing: this.refreshing, onRefresh: this.onRefresh };
          return Ia(Pa(e, this.currentRoute), s);
        }
      }
    } catch (i) {
      return console.error(i), q(Ya(i), n);
    }
  }
}
ue([
  ce({ attribute: !1, hasChanged: Ja })
], X.prototype, "hass");
ue([
  ce({ type: Boolean })
], X.prototype, "narrow");
ue([
  ce({ attribute: !1, hasChanged: Xa })
], X.prototype, "route");
ue([
  ce({ attribute: !1 })
], X.prototype, "panel");
ue([
  mi()
], X.prototype, "refreshing");
customElements.get("hearth-panel") || customElements.define("hearth-panel", X);
export {
  X as HearthPanel,
  xa as PANEL_VERSION,
  Ja as hassChanged
};
