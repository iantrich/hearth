/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ae = globalThis, mt = Ae.ShadowRoot && (Ae.ShadyCSS === void 0 || Ae.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, fn = Symbol(), It = /* @__PURE__ */ new WeakMap();
let fi = class {
  constructor(e, n, i) {
    if (this._$cssResult$ = !0, i !== fn) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = n;
  }
  get styleSheet() {
    let e = this.o;
    const n = this.t;
    if (mt && e === void 0) {
      const i = n !== void 0 && n.length === 1;
      i && (e = It.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), i && It.set(n, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const mn = (t) => new fi(typeof t == "string" ? t : t + "", void 0, fn), mi = (t, e) => {
  if (mt) t.adoptedStyleSheets = e.map((n) => n instanceof CSSStyleSheet ? n : n.styleSheet);
  else for (const n of e) {
    const i = document.createElement("style"), s = Ae.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = n.cssText, t.appendChild(i);
  }
}, Dt = mt ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((e) => {
  let n = "";
  for (const i of e.cssRules) n += i.cssText;
  return mn(n);
})(t) : t;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: gi, defineProperty: vi, getOwnPropertyDescriptor: yi, getOwnPropertyNames: bi, getOwnPropertySymbols: $i, getPrototypeOf: _i } = Object, Ie = globalThis, Ot = Ie.trustedTypes, wi = Ot ? Ot.emptyScript : "", xi = Ie.reactiveElementPolyfillSupport, se = (t, e) => t, Re = { toAttribute(t, e) {
  switch (e) {
    case Boolean:
      t = t ? wi : null;
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
} }, gt = (t, e) => !gi(t, e), Ht = { attribute: !0, type: String, converter: Re, reflect: !1, useDefault: !1, hasChanged: gt };
Symbol.metadata ??= Symbol("metadata"), Ie.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let Y = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, n = Ht) {
    if (n.state && (n.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((n = Object.create(n)).wrapped = !0), this.elementProperties.set(e, n), !n.noAccessor) {
      const i = Symbol(), s = this.getPropertyDescriptor(e, i, n);
      s !== void 0 && vi(this.prototype, e, s);
    }
  }
  static getPropertyDescriptor(e, n, i) {
    const { get: s, set: a } = yi(this.prototype, e) ?? { get() {
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
    return this.elementProperties.get(e) ?? Ht;
  }
  static _$Ei() {
    if (this.hasOwnProperty(se("elementProperties"))) return;
    const e = _i(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(se("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(se("properties"))) {
      const n = this.properties, i = [...bi(n), ...$i(n)];
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
      for (const s of i) n.unshift(Dt(s));
    } else e !== void 0 && n.push(Dt(e));
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
    return mi(e, this.constructor.elementStyles), e;
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
      const a = (i.converter?.toAttribute !== void 0 ? i.converter : Re).toAttribute(n, i.type);
      this._$Em = e, a == null ? this.removeAttribute(s) : this.setAttribute(s, a), this._$Em = null;
    }
  }
  _$AK(e, n) {
    const i = this.constructor, s = i._$Eh.get(e);
    if (s !== void 0 && this._$Em !== s) {
      const a = i.getPropertyOptions(s), r = typeof a.converter == "function" ? { fromAttribute: a.converter } : a.converter?.fromAttribute !== void 0 ? a.converter : Re;
      this._$Em = s;
      const l = r.fromAttribute(n, a.type);
      this[s] = l ?? this._$Ej?.get(s) ?? l, this._$Em = null;
    }
  }
  requestUpdate(e, n, i, s = !1, a) {
    if (e !== void 0) {
      const r = this.constructor;
      if (s === !1 && (a = this[e]), i ??= r.getPropertyOptions(e), !((i.hasChanged ?? gt)(a, n) || i.useDefault && i.reflect && a === this._$Ej?.get(e) && !this.hasAttribute(r._$Eu(e, i)))) return;
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
Y.elementStyles = [], Y.shadowRootOptions = { mode: "open" }, Y[se("elementProperties")] = /* @__PURE__ */ new Map(), Y[se("finalized")] = /* @__PURE__ */ new Map(), xi?.({ ReactiveElement: Y }), (Ie.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const vt = globalThis, Ut = (t) => t, Ne = vt.trustedTypes, Lt = Ne ? Ne.createPolicy("lit-html", { createHTML: (t) => t }) : void 0, gn = "$lit$", H = `lit$${Math.random().toFixed(9).slice(2)}$`, vn = "?" + H, ki = `<${vn}>`, j = document, le = () => j.createComment(""), ce = (t) => t === null || typeof t != "object" && typeof t != "function", yt = Array.isArray, Ci = (t) => yt(t) || typeof t?.[Symbol.iterator] == "function", je = `[ 	
\f\r]`, ne = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, zt = /-->/g, Gt = />/g, F = RegExp(`>|${je}(?:([^\\s"'>=/]+)(${je}*=${je}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Ft = /'/g, Bt = /"/g, yn = /^(?:script|style|textarea|title)$/i, bn = (t) => (e, ...n) => ({ _$litType$: t, strings: e, values: n }), o = bn(1), x = bn(2), I = Symbol.for("lit-noChange"), h = Symbol.for("lit-nothing"), jt = /* @__PURE__ */ new WeakMap(), B = j.createTreeWalker(j, 129);
function $n(t, e) {
  if (!yt(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Lt !== void 0 ? Lt.createHTML(e) : e;
}
const Ai = (t, e) => {
  const n = t.length - 1, i = [];
  let s, a = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", r = ne;
  for (let l = 0; l < n; l++) {
    const c = t[l];
    let d, u, p = -1, v = 0;
    for (; v < c.length && (r.lastIndex = v, u = r.exec(c), u !== null); ) v = r.lastIndex, r === ne ? u[1] === "!--" ? r = zt : u[1] !== void 0 ? r = Gt : u[2] !== void 0 ? (yn.test(u[2]) && (s = RegExp("</" + u[2], "g")), r = F) : u[3] !== void 0 && (r = F) : r === F ? u[0] === ">" ? (r = s ?? ne, p = -1) : u[1] === void 0 ? p = -2 : (p = r.lastIndex - u[2].length, d = u[1], r = u[3] === void 0 ? F : u[3] === '"' ? Bt : Ft) : r === Bt || r === Ft ? r = F : r === zt || r === Gt ? r = ne : (r = F, s = void 0);
    const m = r === F && t[l + 1].startsWith("/>") ? " " : "";
    a += r === ne ? c + ki : p >= 0 ? (i.push(d), c.slice(0, p) + gn + c.slice(p) + H + m) : c + H + (p === -2 ? l : m);
  }
  return [$n(t, a + (t[n] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), i];
};
class de {
  constructor({ strings: e, _$litType$: n }, i) {
    let s;
    this.parts = [];
    let a = 0, r = 0;
    const l = e.length - 1, c = this.parts, [d, u] = Ai(e, n);
    if (this.el = de.createElement(d, i), B.currentNode = this.el.content, n === 2 || n === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (s = B.nextNode()) !== null && c.length < l; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const p of s.getAttributeNames()) if (p.endsWith(gn)) {
          const v = u[r++], m = s.getAttribute(p).split(H), g = /([.?@])?(.*)/.exec(v);
          c.push({ type: 1, index: a, name: g[2], strings: m, ctor: g[1] === "." ? Si : g[1] === "?" ? Ti : g[1] === "@" ? Ri : De }), s.removeAttribute(p);
        } else p.startsWith(H) && (c.push({ type: 6, index: a }), s.removeAttribute(p));
        if (yn.test(s.tagName)) {
          const p = s.textContent.split(H), v = p.length - 1;
          if (v > 0) {
            s.textContent = Ne ? Ne.emptyScript : "";
            for (let m = 0; m < v; m++) s.append(p[m], le()), B.nextNode(), c.push({ type: 2, index: ++a });
            s.append(p[v], le());
          }
        }
      } else if (s.nodeType === 8) if (s.data === vn) c.push({ type: 2, index: a });
      else {
        let p = -1;
        for (; (p = s.data.indexOf(H, p + 1)) !== -1; ) c.push({ type: 7, index: a }), p += H.length - 1;
      }
      a++;
    }
  }
  static createElement(e, n) {
    const i = j.createElement("template");
    return i.innerHTML = e, i;
  }
}
function J(t, e, n = t, i) {
  if (e === I) return e;
  let s = i !== void 0 ? n._$Co?.[i] : n._$Cl;
  const a = ce(e) ? void 0 : e._$litDirective$;
  return s?.constructor !== a && (s?._$AO?.(!1), a === void 0 ? s = void 0 : (s = new a(t), s._$AT(t, n, i)), i !== void 0 ? (n._$Co ??= [])[i] = s : n._$Cl = s), s !== void 0 && (e = J(t, s._$AS(t, e.values), s, i)), e;
}
class Ei {
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
    const { el: { content: n }, parts: i } = this._$AD, s = (e?.creationScope ?? j).importNode(n, !0);
    B.currentNode = s;
    let a = B.nextNode(), r = 0, l = 0, c = i[0];
    for (; c !== void 0; ) {
      if (r === c.index) {
        let d;
        c.type === 2 ? d = new he(a, a.nextSibling, this, e) : c.type === 1 ? d = new c.ctor(a, c.name, c.strings, this, e) : c.type === 6 && (d = new Ni(a, this, e)), this._$AV.push(d), c = i[++l];
      }
      r !== c?.index && (a = B.nextNode(), r++);
    }
    return B.currentNode = j, s;
  }
  p(e) {
    let n = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(e, i, n), n += i.strings.length - 2) : i._$AI(e[n])), n++;
  }
}
class he {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, n, i, s) {
    this.type = 2, this._$AH = h, this._$AN = void 0, this._$AA = e, this._$AB = n, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
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
    e = J(this, e, n), ce(e) ? e === h || e == null || e === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : e !== this._$AH && e !== I && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : Ci(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== h && ce(this._$AH) ? this._$AA.nextSibling.data = e : this.T(j.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: n, _$litType$: i } = e, s = typeof i == "number" ? this._$AC(e) : (i.el === void 0 && (i.el = de.createElement($n(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(n);
    else {
      const a = new Ei(s, this), r = a.u(this.options);
      a.p(n), this.T(r), this._$AH = a;
    }
  }
  _$AC(e) {
    let n = jt.get(e.strings);
    return n === void 0 && jt.set(e.strings, n = new de(e)), n;
  }
  k(e) {
    yt(this._$AH) || (this._$AH = [], this._$AR());
    const n = this._$AH;
    let i, s = 0;
    for (const a of e) s === n.length ? n.push(i = new he(this.O(le()), this.O(le()), this, this.options)) : i = n[s], i._$AI(a), s++;
    s < n.length && (this._$AR(i && i._$AB.nextSibling, s), n.length = s);
  }
  _$AR(e = this._$AA.nextSibling, n) {
    for (this._$AP?.(!1, !0, n); e !== this._$AB; ) {
      const i = Ut(e).nextSibling;
      Ut(e).remove(), e = i;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class De {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, n, i, s, a) {
    this.type = 1, this._$AH = h, this._$AN = void 0, this.element = e, this.name = n, this._$AM = s, this.options = a, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = h;
  }
  _$AI(e, n = this, i, s) {
    const a = this.strings;
    let r = !1;
    if (a === void 0) e = J(this, e, n, 0), r = !ce(e) || e !== this._$AH && e !== I, r && (this._$AH = e);
    else {
      const l = e;
      let c, d;
      for (e = a[0], c = 0; c < a.length - 1; c++) d = J(this, l[i + c], n, c), d === I && (d = this._$AH[c]), r ||= !ce(d) || d !== this._$AH[c], d === h ? e = h : e !== h && (e += (d ?? "") + a[c + 1]), this._$AH[c] = d;
    }
    r && !s && this.j(e);
  }
  j(e) {
    e === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class Si extends De {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === h ? void 0 : e;
  }
}
class Ti extends De {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== h);
  }
}
class Ri extends De {
  constructor(e, n, i, s, a) {
    super(e, n, i, s, a), this.type = 5;
  }
  _$AI(e, n = this) {
    if ((e = J(this, e, n, 0) ?? h) === I) return;
    const i = this._$AH, s = e === h && i !== h || e.capture !== i.capture || e.once !== i.once || e.passive !== i.passive, a = e !== h && (i === h || s);
    s && this.element.removeEventListener(this.name, this, i), a && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class Ni {
  constructor(e, n, i) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = n, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    J(this, e);
  }
}
const Mi = vt.litHtmlPolyfillSupport;
Mi?.(de, he), (vt.litHtmlVersions ??= []).push("3.3.3");
const Pi = (t, e, n) => {
  const i = n?.renderBefore ?? e;
  let s = i._$litPart$;
  if (s === void 0) {
    const a = n?.renderBefore ?? null;
    i._$litPart$ = s = new he(e.insertBefore(le(), a), a, void 0, n ?? {});
  }
  return s._$AI(t), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const bt = globalThis;
let ae = class extends Y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    const n = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Pi(n, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return I;
  }
};
ae._$litElement$ = !0, ae.finalized = !0, bt.litElementHydrateSupport?.({ LitElement: ae });
const Ii = bt.litElementPolyfillSupport;
Ii?.({ LitElement: ae });
(bt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Di = { attribute: !0, type: String, converter: Re, reflect: !1, hasChanged: gt }, Oi = (t = Di, e, n) => {
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
function ue(t) {
  return (e, n) => typeof n == "object" ? Oi(t, e, n) : ((i, s, a) => {
    const r = s.hasOwnProperty(a);
    return s.constructor.createProperty(a, i), r ? Object.getOwnPropertyDescriptor(s, a) : void 0;
  })(t, e, n);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function Hi(t) {
  return ue({ ...t, state: !0, attribute: !1 });
}
function Ui(t) {
  return t && typeof t == "object" ? t : null;
}
class S extends Error {
  constructor(e, n, i, s = []) {
    super(n), this.code = e, this.field = i, this.problems = s, this.name = "HearthError";
  }
}
const Li = /^([A-Za-z_][\w.]*): /;
function Vt(t) {
  if (t instanceof S) return t;
  const e = t ?? {}, n = typeof e.message == "string" ? e.message : String(t);
  if (typeof e.code == "string" && e.code) {
    const i = e.code === "invalid" ? Li.exec(n)?.[1] : void 0;
    return new S(e.code, n, i);
  }
  return typeof e.code == "number" ? new S("offline", n) : t instanceof Error ? new S("unknown_error", n) : new S("offline", n);
}
class zi {
  /** `auth` is read when an upload starts, because Home Assistant swaps it when the token refreshes. */
  constructor(e, n = () => {
  }) {
    this.conn = e, this.auth = n;
  }
  async send(e) {
    try {
      return await this.conn.sendMessagePromise(e);
    } catch (n) {
      throw Vt(n);
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
      return await this.conn.subscribeMessage((n) => e(Ui(n)), { type: "hearth_crm/subscribe" }, { resubscribe: !1 });
    } catch (n) {
      throw Vt(n);
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
  reminderComplete(e) {
    return this.send({ type: "hearth_crm/reminder/complete", entity_id: e });
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
    if (!i) throw new S("unknown_error", "Not signed in to Home Assistant.");
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
      throw new S("offline", l instanceof Error ? l.message : String(l));
    }
    if (a.ok) return await a.json();
    let r = null;
    try {
      r = await a.json();
    } catch {
    }
    if (typeof r?.reason == "string") {
      const l = Array.isArray(r.problems) ? r.problems.filter((c) => typeof c == "string") : [];
      throw new S(r.reason, typeof r.message == "string" ? r.message : r.reason, void 0, l);
    }
    throw new S("import_failed", "Import failed unexpectedly; see the Home Assistant log.");
  }
}
const _ = "/hearth";
function Gi(t) {
  const e = t.split("/").filter(Boolean).map(Fi), [n, i, s] = e;
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
      if (i && s === "reminder" && e[3] === "new") return { name: "reminderNew", personId: i };
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
    case "reminder":
      if (i === "new") return { name: "reminderNewAny" };
      if (i) return { name: "reminder", id: i };
      break;
    case "interaction":
      if (i && s === "reminder" && e[3] === "new") return { name: "interactionReminderNew", interactionId: i };
      if (i) return { name: "interaction", id: i, sheet: s === "edit" ? "edit" : null };
      break;
  }
  return { name: "home" };
}
function Fi(t) {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}
const R = encodeURIComponent, f = {
  home: () => _,
  search: () => `${_}/search`,
  reachOut: () => `${_}/reach-out`,
  add: () => `${_}/add`,
  birthdays: () => `${_}/birthdays`,
  interactions: () => `${_}/interactions`,
  settings: () => `${_}/settings`,
  person: (t) => `${_}/person/${R(t)}`,
  logInteraction: (t) => `${_}/person/${R(t)}/log`,
  editPerson: (t) => `${_}/person/${R(t)}/edit`,
  newRelationship: (t) => `${_}/person/${R(t)}/relationship/new`,
  relationship: (t, e) => `${_}/person/${R(t)}/relationship/${R(e)}`,
  household: (t) => `${_}/household/${R(t)}`,
  newHousehold: () => `${_}/household/new`,
  editHousehold: (t) => `${_}/household/${R(t)}/edit`,
  group: (t) => `${_}/group/${R(t)}`,
  newGroup: () => `${_}/group/new`,
  editGroup: (t) => `${_}/group/${R(t)}/edit`,
  interaction: (t) => `${_}/interaction/${R(t)}`,
  editInteraction: (t) => `${_}/interaction/${R(t)}/edit`,
  reminder: (t) => `${_}/reminder/${R(t)}`,
  newReminderAny: () => `${_}/reminder/new`,
  newReminder: (t) => `${_}/person/${R(t)}/reminder/new`,
  newInteractionReminder: (t) => `${_}/interaction/${R(t)}/reminder/new`
};
function Bi(t) {
  return t === _ || t.startsWith(`${_}/`) || t.startsWith(`${_}?`);
}
function ji(t) {
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
const Qe = "hearthDepth";
function et() {
  const t = history.state?.[Qe];
  return typeof t == "number" ? t : 0;
}
function z(t, e = !1) {
  e ? history.replaceState({ [Qe]: et() }, "", t) : history.pushState({ [Qe]: et() + 1 }, "", t), window.dispatchEvent(new Event("location-changed"));
}
function O(t) {
  et() > 0 ? history.back() : z(t, !0);
}
/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const qt = (t) => t ?? h;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const q = { ATTRIBUTE: 1, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4 }, _n = (t) => (...e) => ({ _$litDirective$: t, values: e });
let wn = class {
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
const Vi = (t) => t.strings === void 0, qi = {}, xn = (t, e = qi) => t._$AH = e;
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ki = _n(class extends wn {
  constructor() {
    super(...arguments), this.key = h;
  }
  render(t, e) {
    return this.key = t, e;
  }
  update(t, [e, n]) {
    return e !== this.key && (xn(t), this.key = e), n;
  }
});
function $t(t) {
  return /* @__PURE__ */ new Date(`${t}T00:00:00Z`);
}
const Yi = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), Wi = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), Ji = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }), Me = (t) => Yi.format($t(t)), Xi = (t) => Wi.format($t(t)), kn = (t) => Ji.format($t(t));
function Zi(t, e, n) {
  if (e) return Me(t);
  const i = `${Me(t)}, ${t.slice(0, 4)}`;
  return n === null ? i : `${i} - ${n}`;
}
function Qi(t) {
  return t === 0 ? "Today" : `In ${t} ${t === 1 ? "day" : "days"}`;
}
function es(t) {
  return t.trim().split(/\s+/).slice(0, 2).map((e) => e.charAt(0)).join("").toUpperCase();
}
function Oe(t, e, n = `${e}s`) {
  return `${t} ${t === 1 ? e : n}`;
}
const E = (t) => x`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`, ve = (t) => x`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${t}</svg>`, w = {
  home: E(x`<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>`),
  search: E(x`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`),
  mic: ve(x`<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/>`),
  bell: E(x`<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`),
  plusCircle: E(x`<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>`),
  plus: E(x`<path d="M12 5v14M5 12h14"/>`),
  star: E(x`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  starFill: ve(x`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  phone: E(x`<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>`),
  message: E(x`<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.6A8.5 8.5 0 1 1 21 12z"/>`),
  envelope: E(x`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`),
  mapPin: E(x`<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`),
  globe: E(x`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>`),
  linkedIn: ve(x`<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/>`),
  facebook: ve(x`<path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2C16.7 2.1 15.7 2 14.6 2 12.2 2 10.6 3.4 10.6 6.1v2.4H8v3.3h2.6V22H14V11.8h2.6l.4-3.3z"/>`),
  instagram: E(x`<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>`),
  pencil: E(x`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`),
  trash: E(x`<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>`),
  back: E(x`<path d="m15 18-6-6 6-6"/>`),
  refresh: E(x`<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>`),
  gear: E(x`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`),
  menu: E(x`<path d="M4 6h16M4 12h16M4 18h16"/>`),
  close: E(x`<path d="M6 6l12 12M18 6 6 18"/>`)
};
function C(t, e, n = 42) {
  const i = Math.round(n * 15 / 42);
  return o`<span class="avatar" style="width:${n}px;height:${n}px;font-size:${i}px">
    ${es(t)}
    ${e ? Ki(
    e,
    o`<img src=${e} alt="" loading="lazy" @error=${(s) => s.target.classList.add("broken")} />`
  ) : h}
  </span>`;
}
function ts(t, e = 42, n = 3) {
  const i = t.slice(0, n), s = t.length - i.length, a = Math.round(e / 3);
  return o`<span class="stack" aria-hidden="true">
    ${i.map(
    (r, l) => o`<span style="margin-left:${l === 0 ? 0 : -a}px;z-index:${i.length - l};display:inline-flex"
          >${C(r.name, r.photo_url, e)}</span
        >`
  )}
    ${s > 0 ? o`<span style="margin-left:${-a}px;z-index:${i.length + 1};display:inline-flex"
          ><span class="avatar" style="width:${e}px;height:${e}px;font-size:${Math.round(e * 15 / 42)}px;box-shadow:0 0 0 2px var(--surface)"
            >+${s}</span
          ></span
        >` : h}
  </span>`;
}
function tt(t, e) {
  const n = t.contact_status, i = e ?? t.how_i_know_them?.trim() ?? "", s = n.days_since_contact === null ? "—" : `${n.days_since_contact}d ago`;
  return o`<a class="row" href=${f.person(t.id)}>
    ${C(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}${t.favorite ? o`<span class="star">${w.starFill}</span>` : h}</div>
      ${i ? o`<div class="sub">${i}</div>` : h}
    </span>
    <span class="meta ${n.urgency === "overdue" ? "danger" : ""}">${s}</span>
  </a>`;
}
function ns(t) {
  return t.href ? o`<a
      class="icon-btn ${t.className ?? ""}"
      href=${t.href}
      target=${qt(t.external ? "_blank" : void 0)}
      rel=${qt(t.external ? "noopener noreferrer" : void 0)}
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
const is = (t) => o`<div class="label list-label">${t}</div>`;
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const k = _n(class extends wn {
  constructor(t) {
    if (super(t), t.type !== q.PROPERTY && t.type !== q.ATTRIBUTE && t.type !== q.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
    if (!Vi(t)) throw Error("`live` bindings can only contain a single expression");
  }
  render(t) {
    return t;
  }
  update(t, [e]) {
    if (e === I || e === h) return e;
    const n = t.element, i = t.name;
    if (t.type === q.PROPERTY) {
      if (e === n[i]) return I;
    } else if (t.type === q.BOOLEAN_ATTRIBUTE) {
      if (!!e === n.hasAttribute(i)) return I;
    } else if (t.type === q.ATTRIBUTE && n.getAttribute(i) === e + "") return I;
    return xn(t), e;
  }
}), ss = () => ({
  name: "",
  phone: "",
  email: "",
  how_i_know_them: "",
  has_birthday: !1,
  birthday: "",
  birth_year_unknown: !1
}), as = { name: 200, phone: 50, email: 500, how_i_know_them: 2e3 }, Ve = (t) => t.trim() || null, Kt = "add-person";
function rs(t) {
  const e = t.drafts.open(Kt, f.add(), ss), n = (r) => t.drafts.patch(Kt, r), i = e.name.trim() !== "" && (!e.has_birthday || e.birthday !== ""), s = (r, l, c = "text", d = "off") => o`<label class="field">
      <span>${l}</span>
      <input
        id=${`add-${r.replace(/_/g, "-")}`}
        class="input"
        type=${c}
        autocomplete=${d}
        maxlength=${as[r]}
        .value=${k(e[r])}
        @input=${(u) => n({ [r]: u.target.value })}
      />
    </label>`, a = async () => {
    if (!i) return;
    const r = await t.addPerson({
      name: e.name,
      phone: Ve(e.phone),
      email: Ve(e.email),
      how_i_know_them: Ve(e.how_i_know_them),
      birthday: e.has_birthday ? e.birthday : null,
      birth_year_unknown: e.has_birthday && e.birth_year_unknown
    });
    r && z(f.person(r));
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
            </label>` : h}
      <button class="btn" ?disabled=${!i || t.busy} @click=${a}>Save</button>
    </div>`
  };
}
const os = new Intl.Collator("en", { numeric: !0, sensitivity: "base" });
function L(t, e) {
  return os.compare(t, e);
}
function nt(t, e) {
  return L(t.name, e.name);
}
function He(t) {
  return t.trim().split(/\s+/)[0] ?? "";
}
function Z(t) {
  return t.name_status !== "needs_name" && t.name_status !== "not_a_household" && !!t.name;
}
function D(t) {
  return Z(t) ? t.name : t.name_status === "not_a_household" ? "Not a household" : "Needs a name";
}
function _t(t, e) {
  const n = D(t);
  if (Z(t)) return n;
  const i = t.member_ids.map((s) => e.find((a) => a.id === s)).filter((s) => !!s).map((s) => He(s.name)).filter(Boolean);
  return i.length ? `${n} (${i.join(", ")})` : n;
}
function Cn(t, e) {
  return t.filter(
    (n) => n.days_until_birthday !== null && (e === void 0 || n.days_until_birthday <= e)
  ).sort((n, i) => n.days_until_birthday - i.days_until_birthday || L(n.name, i.name));
}
const ls = /^(\d{4})-(\d{2})-(\d{2})$/, cs = 864e5;
function ds(t) {
  const e = ls.exec(t);
  if (!e) throw new Error(`Not a calendar day: ${t}`);
  return Date.UTC(Number(e[1]), Number(e[2]) - 1, Number(e[3]));
}
function hs(t, e) {
  return new Date(ds(t) + e * cs).toISOString().slice(0, 10);
}
const us = 6;
function ps(t) {
  return t.filter((e) => e.favorite).slice(0, us);
}
function An(t, e, n) {
  const i = new Set(e.map((a) => a.id)), { since: s } = n;
  return t.filter((a) => (s === void 0 || a.date >= s) && a.person_ids.some((r) => i.has(r))).sort(En).slice(0, n.limit);
}
function fs(t, e) {
  return t.filter((n) => n.person_ids.includes(e)).sort(En);
}
function En(t, e) {
  return t.date === e.date ? 0 : t.date > e.date ? -1 : 1;
}
function Ue(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const i of e) n.has(i.id) || n.set(i.id, i);
  return t.person_ids.flatMap((i) => {
    const s = n.get(i);
    return s ? [s] : [];
  });
}
function ms(t) {
  const e = (s) => He(s.name) || s.name, [n, i] = t;
  return n ? i ? t.length === 2 ? `${e(n)} & ${e(i)}` : `${e(n)} and ${t.length - 1} others` : n.name : "";
}
function $(t) {
  if (!t.snapshot) throw new Error("No snapshot to draw from");
  return t.snapshot;
}
function G(t) {
  return { title: null, back: !0, actions: [], body: o`<div class="empty">This ${t} no longer exists.</div>` };
}
const pe = {
  title: null,
  back: !0,
  actions: [],
  body: o`<div class="center"><div><div class="spinner"></div></div></div>`
};
function Sn(t, e) {
  const n = e.length === 1 ? e[0] : void 0, i = o`${ts(e)}<span class="name" style="flex:1;min-width:0"
      >${ms(e)}</span
    >`;
  return o`<div class="row" style="flex-direction:column;align-items:stretch;gap:2px">
    <a
      href=${n ? f.person(n.id) : f.interaction(t.id)}
      style="display:flex;align-items:center;gap:12px"
      >${i}</a
    >
    <a href=${f.interaction(t.id)} style="display:flex;gap:12px">
      <span class="sub" style="flex:1">${t.summary}</span>
      <span class="meta">${Me(t.date)}</span>
    </a>
  </div>`;
}
function gs(t) {
  return o`<a class="row" href=${f.person(t.id)}>
    ${C(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${Qi(t.days_until_birthday ?? 0)}</div>
    </span>
  </a>`;
}
function vs(t) {
  const { people: e, interactions: n, today: i } = $(t), s = ps(e), a = Cn(e, 30).slice(0, 3), r = An(n, e, { since: hs(i, -30), limit: 10 });
  return {
    title: "Hearth",
    back: !1,
    actions: [{ icon: w.gear, label: "Settings", href: f.settings() }],
    body: o`<div class="page">
      ${s.length ? o`<div class="list favorites" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 12px;padding:16px">
            ${s.map(
      (l) => o`<a href=${f.person(l.id)} style="display:grid;justify-items:center;gap:6px;min-width:0">
                ${C(l.name, l.photo_url, 56)}
                <span class="fav-name" style="font-weight:600;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >${He(l.name)}</span
                >
              </a>`
    )}
          </div>` : h}

      <div class="section">
        <div class="section-head"><h2>Upcoming</h2><a href=${f.birthdays()}>See all</a></div>
        <div class="list">
          ${a.length ? a.map(gs) : o`<div class="empty">No birthdays in the next 30 days.</div>`}
        </div>
      </div>

      <div class="section">
        <!-- "See more", not "See all": that list caps at 25. -->
        <div class="section-head"><h2>Recent</h2><a href=${f.interactions()}>See more</a></div>
        <div class="list">
          ${r.length ? r.map((l) => Sn(l, Ue(l, e))) : o`<div class="empty">Nothing logged in the last 30 days.</div>`}
        </div>
      </div>
    </div>`
  };
}
function ys(t) {
  const e = Cn($(t).people);
  return {
    title: "Birthdays",
    back: !0,
    actions: [],
    body: o`<div class="page list">
      ${e.length ? e.map((n) => {
      const i = n.days_until_birthday ?? 0;
      return o`<a class="row" href=${f.person(n.id)}>
              ${C(n.name, n.photo_url)}
              <span class="main"><div class="name">${n.name}</div></span>
              <span class="meta">${i === 0 ? "Today" : `${i}d`}</span>
            </a>`;
    }) : o`<div class="empty">No birthdays yet.</div>`}
    </div>`
  };
}
function bs(t) {
  const { people: e, interactions: n } = $(t), i = An(n, e, { limit: 25 });
  return {
    title: "Recent",
    back: !0,
    actions: [],
    body: o`<div class="page list">
      ${i.length ? i.map((s) => Sn(s, Ue(s, e))) : o`<div class="empty">No interactions yet.</div>`}
    </div>`
  };
}
function M(t) {
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
function V(t, e) {
  return {
    get: (n) => (t.drafts.get(e) ?? {})[n],
    set: (n, i) => t.drafts.patch(e, { [n]: i }),
    error: (n) => Tn(t.writeError, n)
  };
}
function Tn(t, e) {
  const n = t?.field;
  if (!t || !n || n !== e && !n.startsWith(`${e}.`)) return null;
  const i = `${n}: `;
  return t.message.startsWith(i) ? t.message.slice(i.length) : t.message;
}
const Q = (t) => `field-${t.replace(/_/g, "-")}`, fe = (t, e) => {
  const n = t.get(e);
  return typeof n == "string" ? n : "";
}, wt = (t) => t.target.value;
function ee(t, e) {
  const n = t.error(e);
  return n ? o`<div class="field-error" role="alert" data-error-for=${e}>${n}</div>` : h;
}
function N(t, e, n, i = {}) {
  return o`<label class="field">
    <span>${n}</span>
    <input
      id=${Q(e)}
      name=${e}
      class="input"
      type=${i.type ?? "text"}
      autocomplete=${i.autocomplete ?? "off"}
      maxlength=${i.maxlength ?? 200}
      placeholder=${i.placeholder ?? ""}
      ?required=${i.required ?? !1}
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(fe(t, e))}
      @input=${(s) => t.set(e, wt(s))}
    />
    ${ee(t, e)}
  </label>`;
}
function X(t, e, n, i) {
  return o`<label class="field">
    <span>${n}</span>
    <textarea
      id=${Q(e)}
      name=${e}
      class="input"
      maxlength=${i}
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(fe(t, e))}
      @input=${(s) => t.set(e, s.target.value)}
    ></textarea>
    ${ee(t, e)}
  </label>`;
}
function ye(t, e, n) {
  return o`<label class="field">
    <span>${n}</span>
    <input
      id=${Q(e)}
      name=${e}
      class="input"
      type="url"
      inputmode="url"
      autocapitalize="off"
      autocomplete="off"
      maxlength="500"
      placeholder="https://"
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(fe(t, e))}
      @input=${(i) => t.set(e, wt(i))}
    />
    ${ee(t, e)}
  </label>`;
}
function it(t, e, n) {
  return N(t, e, n, { maxlength: 1e3 });
}
function $s(t, e, n, i) {
  const s = fe(t, e);
  return o`<label class="field">
      <span>${n}</span>
      <input
        id=${Q(e)}
        name=${e}
        class="input"
        type="date"
        aria-invalid=${t.error(e) ? "true" : "false"}
        .value=${k(s)}
        @input=${(a) => {
    const r = wt(a);
    t.set(e, r), r || t.set(i, !1);
  }}
      />
      ${ee(t, e)}
    </label>
    ${s ? st(t, i, "Year unknown") : h}`;
}
function st(t, e, n) {
  return o`<label class="check">
      <input
        id=${Q(e)}
        name=${e}
        type="checkbox"
        .checked=${k(t.get(e) === !0)}
        @change=${(i) => t.set(e, i.target.checked)}
      />
      ${n}
    </label>
    ${ee(t, e)}`;
}
function xt(t, e, n, i) {
  const s = fe(t, e);
  return o`<label class="field">
    <span>${n}</span>
    <select
      id=${Q(e)}
      name=${e}
      class="input"
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(s)}
      @change=${(a) => t.set(e, a.target.value)}
    >
      ${i.map((a) => o`<option value=${a.value} ?selected=${a.value === s}>${a.label}</option>`)}
    </select>
    ${ee(t, e)}
  </label>`;
}
function Yt(t) {
  return t.birthday && !t.birth_year_unknown ? t.birthday : null;
}
function Rn(t, e) {
  const n = Yt(t), i = Yt(e);
  return n && i && n !== i ? n < i ? -1 : 1 : n && !i ? -1 : !n && i ? 1 : L(t.name, e.name);
}
const Nn = [
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
], _s = new Map(Nn.map((t, e) => [t, e]));
function Wt(t) {
  return (t === null ? void 0 : _s.get(t)) ?? Nn.length;
}
function ws(t) {
  return [...t].sort((e, n) => {
    const i = Wt(e.connectionType) - Wt(n.connectionType);
    return i !== 0 ? i : Rn(e.person, n.person);
  });
}
const re = { parent: 0, unplaced: 1, child: 2 };
function xs(t, e) {
  const n = new Set(t), i = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), a = (l, c) => {
    c === "Parent" ? i.add(l) : c === "Child" && s.add(l);
  };
  for (const l of e)
    !n.has(l.person_a_id) || !n.has(l.person_b_id) || (a(l.person_b_id, l.type), a(l.person_a_id, l.inverse_type));
  const r = /* @__PURE__ */ new Map();
  for (const l of t)
    i.has(l) ? r.set(l, re.parent) : s.has(l) ? r.set(l, re.child) : r.set(l, re.unplaced);
  return r;
}
function kt(t, e, n, i) {
  const s = xs(e, n);
  return [...t].sort((a, r) => {
    const l = i(a), c = i(r), d = s.get(l.id) ?? re.unplaced, u = s.get(c.id) ?? re.unplaced;
    return d !== u ? d - u : Rn(l, c);
  });
}
function Le(t, e) {
  return t.person_a_id === t.person_b_id ? null : t.person_a_id === e ? { otherId: t.person_b_id, type: t.type } : t.person_b_id === e ? { otherId: t.person_a_id, type: t.inverse_type } : null;
}
function ks(t) {
  return t.householdMembers.length === 0 && t.others.length === 0 && t.groups.length === 0;
}
function Cs(t, e) {
  const { people: n, households: i, groups: s, relationships: a, excludedId: r } = e, l = /* @__PURE__ */ new Map();
  for (const b of n) l.has(b.id) || l.set(b.id, b);
  const c = /* @__PURE__ */ new Map(), d = [];
  for (const b of a) {
    const y = Le(b, t);
    !y || y.otherId === r || c.has(y.otherId) || (c.set(y.otherId, { type: y.type, relationshipId: b.id }), d.push(y.otherId));
  }
  const u = (b) => {
    const y = l.get(b), T = c.get(b);
    return y ? { person: y, connectionType: T?.type ?? null, relationshipId: T?.relationshipId ?? null } : null;
  }, p = /* @__PURE__ */ new Set([t]), v = i.find((b) => b.member_ids.includes(t)) ?? null, m = [];
  for (const b of v?.member_ids ?? []) {
    if (b === r || p.has(b)) continue;
    p.add(b);
    const y = u(b);
    y && m.push(y);
  }
  const g = kt(m, v?.member_ids ?? [], a, (b) => b.person), A = ws(
    d.filter((b) => !p.has(b)).map(u).filter((b) => b !== null)
  );
  return {
    // Dropped when nobody is left to list under it, so the view never draws a household
    // heading over an empty group.
    household: g.length === 0 ? null : v,
    householdMembers: g,
    others: A,
    groups: s.filter((b) => b.member_ids.includes(t)).sort((b, y) => L(b.name, y.name))
  };
}
function Ct(t, e, n) {
  const i = [...e].sort(nt);
  if (t === "") return { direct: i, connected: [] };
  const s = t.toLocaleLowerCase(), a = i.filter((u) => u.name.toLocaleLowerCase().includes(s)), r = new Map(a.map((u) => [u.id, u])), l = /* @__PURE__ */ new Map();
  for (const u of i) l.has(u.id) || l.set(u.id, u);
  const c = [], d = new Set(r.keys());
  for (const u of n) {
    const p = [u.person_a_id, u.person_b_id].find((A) => r.has(A));
    if (p === void 0) continue;
    const v = Le(u, p);
    if (!v || d.has(v.otherId)) continue;
    d.add(v.otherId);
    const m = l.get(v.otherId), g = r.get(p);
    !m || !g || c.push({ person: m, reason: `${v.type} of ${g.name}` });
  }
  return { direct: a, connected: c.sort((u, p) => nt(u.person, p.person)) };
}
const As = 8, Es = 200;
function me(t, e) {
  const { people: n, relationships: i } = $(t), s = `picker:${e.id}`, a = t.drafts.open(s, e.path, () => ({ query: "" })).query, r = e.selected ?? [], l = /* @__PURE__ */ new Set([...e.exclude ?? [], ...r]), c = r.map((g) => n.find((A) => A.id === g)).filter((g) => !!g), d = a.trim(), u = [];
  if (d) {
    const g = Ct(d, n, i);
    for (const A of g.direct) u.push({ person: A });
    for (const A of g.connected) u.push(A);
  }
  const p = u.filter((g) => !l.has(g.person.id)).slice(0, As), v = (g) => {
    t.drafts.patch(s, { query: "" }), e.onPick(g);
  }, m = () => {
    t.drafts.patch(s, { query: "" }), e.onCreate?.(d);
  };
  return o`<div class="field person-picker">
    <label for=${e.id}><span>${e.label}</span></label>
    ${c.length ? o`<div class="chips">
          ${c.map(
    (g) => o`<span class="chip">
              ${C(g.name, g.photo_url, 18)} ${g.name}
              ${e.onRemove ? o`<button
                    class="chip-remove"
                    aria-label=${`Remove ${g.name}`}
                    title=${`Remove ${g.name}`}
                    ?disabled=${e.disabled ?? !1}
                    @click=${() => e.onRemove(g.id)}
                  >
                    ×
                  </button>` : h}
            </span>`
  )}
        </div>` : h}
    <input
      id=${e.id}
      class="input"
      type="search"
      placeholder="Search people"
      autocomplete="off"
      .value=${k(a)}
      @input=${(g) => t.drafts.patch(s, { query: g.target.value })}
    />
    ${d ? o`<div class="list">
          ${p.length ? p.map(
    ({ person: g, reason: A }) => o`<button
                  class="row picker-choice"
                  ?disabled=${e.disabled ?? !1}
                  @click=${() => v(g.id)}
                >
                  ${C(g.name, g.photo_url)}
                  <span class="main">
                    <div class="name">${g.name}</div>
                    ${A ? o`<div class="sub">${A}</div>` : h}
                  </span>
                </button>`
  ) : o`<div class="empty">No one matches “${d}”.</div>`}
          ${e.onCreate ? o`<button
                class="row picker-create"
                ?disabled=${(e.disabled ?? !1) || d.length > Es}
                @click=${m}
              >
                <span class="main"><div class="name accent">Create “${d}”</div></span>
              </button>` : h}
        </div>` : h}
  </div>`;
}
const Ss = "08:00", Ts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ze(t) {
  const [e, n, i] = t.split("-").map(Number);
  return [e, n, i];
}
function Mn(t, e, n) {
  return `${String(t).padStart(4, "0")}-${String(e).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
function Jt(t, e) {
  const [n, i, s] = ze(t), a = new Date(Date.UTC(n, i - 1, s + e));
  return Mn(a.getUTCFullYear(), a.getUTCMonth() + 1, a.getUTCDate());
}
function qe(t, e) {
  const [n, i, s] = ze(t), a = n * 12 + (i - 1) + e, r = Math.floor(a / 12), l = a % 12 + 1, c = new Date(Date.UTC(r, l, 0)).getUTCDate();
  return Mn(r, l, Math.min(s, c));
}
function Rs(t, e) {
  let n;
  switch (t) {
    case "someday":
      return null;
    case "tomorrow":
      n = Jt(e, 1);
      break;
    case "next_week": {
      const [i, s, a] = ze(e), r = new Date(Date.UTC(i, s - 1, a)).getUTCDay();
      n = Jt(e, (8 - r) % 7 || 7);
      break;
    }
    case "month":
      n = qe(e, 1);
      break;
    case "quarter":
      n = qe(e, 3);
      break;
    case "year":
      n = qe(e, 12);
      break;
  }
  return `${n}T${Ss}`;
}
function At(t, e) {
  return t === 1 ? `Every ${e}` : `Every ${t} ${e}s`;
}
function Xt(t) {
  const [, e, n] = ze(t);
  return `${Ts[e - 1]} ${n}`;
}
function Ns(t) {
  const [e, n] = t.split(":").map(Number);
  return `${e % 12 || 12}:${String(n).padStart(2, "0")} ${e < 12 ? "AM" : "PM"}`;
}
function Pn(t, e) {
  return t.due_date ? t.state === "overdue" ? `Overdue · ${Xt(t.due_date)}` : t.state === "due_today" || t.due_date === e ? t.due_time ? `Today ${Ns(t.due_time)}` : "Today" : Xt(t.due_date) : "Someday";
}
function Ms(t) {
  const e = t.filter((s) => s.state !== "done"), n = (s) => `${s.due_date ?? ""}T${s.due_time ?? ""}`, i = (s, a) => n(s).localeCompare(n(a));
  return {
    due: e.filter((s) => s.state === "overdue" || s.state === "due_today").sort(i),
    upcoming: e.filter((s) => s.state === "upcoming").sort(i),
    someday: e.filter((s) => s.state === "someday")
  };
}
const Et = "08:00", Ps = 2e4, at = 999, Is = [
  { pick: "tomorrow", label: "Tomorrow" },
  { pick: "next_week", label: "Next week" },
  { pick: "month", label: "In a month" },
  { pick: "quarter", label: "In a quarter" },
  { pick: "year", label: "In a year" },
  { pick: "someday", label: "Someday" },
  { pick: "custom", label: "Custom" }
], Ds = { day: "Days", week: "Weeks", month: "Months", year: "Years" };
function In() {
  return { note: "", pick: null, date: "", time: Et, repeat_every: "1", repeat_unit: "" };
}
function Os(t) {
  return {
    note: t.note ?? "",
    pick: t.due_date ? "custom" : "someday",
    date: t.due_date ?? "",
    time: t.due_time ?? Et,
    repeat_every: String(t.repeat_every ?? 1),
    repeat_unit: t.repeat_unit ?? ""
  };
}
function Dn(t) {
  const e = Number(t);
  return Number.isInteger(e) && e >= 1 && e <= at ? e : null;
}
function oe(t) {
  if (!t.pick) return null;
  const e = t.note.trim() || null;
  if (t.pick === "someday") return { note: e, due_at: null, repeat_every: null, repeat_unit: null };
  if (!t.date || !t.time) return null;
  const n = `${t.date}T${t.time}`;
  if (!t.repeat_unit) return { note: e, due_at: n, repeat_every: null, repeat_unit: null };
  const i = Dn(t.repeat_every);
  return i === null ? null : { note: e, due_at: n, repeat_every: i, repeat_unit: t.repeat_unit };
}
function Hs(t, e) {
  return {
    get: (n) => (t.get(e) ?? {})[n],
    set: (n, i) => t.set(e, { ...t.get(e) ?? {}, [n]: i }),
    error: (n) => t.error(n)
  };
}
function On(t, e, n, i = !1) {
  const s = t.get("pick"), a = (p) => {
    if (t.set("pick", p), p === "custom") return;
    const v = Rs(p, e);
    t.set("date", v ? v.slice(0, 10) : ""), t.set("time", v ? v.slice(11) : Et), t.set("repeat_unit", "");
  }, r = String(t.get("repeat_unit") ?? ""), l = String(t.get("repeat_every") ?? ""), c = Dn(l), d = (p) => String(t.get(p) ?? ""), u = (p) => (v) => t.set(p, v.target.value);
  return o`${X(t, "note", "Note", Ps)}
    <div class="field">
      <span>Remind me</span>
      <div class="pills" style="flex-wrap:wrap">
        ${Is.map(
    (p) => o`<button
            class="pill ${s === p.pick ? "on" : ""}"
            aria-pressed=${s === p.pick ? "true" : "false"}
            ?disabled=${i}
            @click=${() => a(p.pick)}
          >
            ${p.label}
          </button>`
  )}
      </div>
    </div>
    ${s === "custom" ? o`<label class="field">
            <span>Date</span>
            <input id="field-date" name="date" class="input" type="date" .value=${k(d("date"))} @input=${u("date")} />
          </label>
          <label class="field">
            <span>Time</span>
            <input id="field-time" name="time" class="input" type="time" .value=${k(d("time"))} @input=${u("time")} />
          </label>
          ${xt(t, "repeat_unit", "Repeat", [
    { value: "", label: "Doesn't repeat" },
    ...n.map((p) => ({ value: p, label: Ds[p] ?? p }))
  ])}
          ${r ? o`<label class="field">
                <span>Every</span>
                <input id="field-repeat-every" name="repeat_every" class="input" type="number" inputmode="numeric" min="1" max=${at}
                  aria-invalid=${c === null ? "true" : "false"} .value=${k(l)} @input=${u("repeat_every")} />
                <div class="muted" style="font-size:12px">${c === null ? `A number from 1 to ${at}` : At(c, r)}</div>
              </label>` : h}` : h}`;
}
const Us = "https://claude.ai/new";
function Ls(t, e, n, i) {
  return t.drafts.open(e, n, () => {
    const { interaction_types: s, today: a } = $(t);
    return {
      type: i?.type ?? s[0] ?? "",
      date: i?.date ?? a,
      summary: i?.summary ?? "",
      notes: i?.notes ?? "",
      reminder: null
    };
  });
}
const Zt = (t) => ({
  type: t.type,
  date: t.date,
  summary: t.summary.trim(),
  notes: t.notes.trim() || null
});
function Hn(t, e, n) {
  const i = n ? `edit:${n.id}` : `log:${e.id}`, s = Ls(t, i, n ? f.editInteraction(n.id) : f.logInteraction(e.id), n), a = $(t).interaction_types, r = () => {
    t.drafts.drop(i), O(n ? f.interaction(n.id) : f.person(e.id));
  }, l = (m) => t.drafts.patch(i, m), c = !s.reminder || oe(s.reminder) !== null && $(t).people.some((m) => m.id === s.reminder?.person), d = s.summary.trim() !== "" && s.date !== "" && s.type !== "" && c, u = (m) => Tn(t.writeError, m), p = (m) => {
    const g = u(m);
    return g ? o`<div class="field-error" role="alert" data-error-for=${m}>${g}</div>` : h;
  }, v = async () => {
    if (!d) return;
    const m = Zt(s), g = t.drafts.base(i);
    if (n) {
      await t.updateInteraction(n.id, m, g && Zt(g)) && r();
      return;
    }
    const A = await t.createInteraction({ person_ids: [e.id], ...m });
    if (A === null) return;
    const b = s.reminder && oe(s.reminder);
    b && s.reminder && await t.addReminder({ person_id: s.reminder.person, interaction_id: A, ...b }), r();
  };
  return o`<div class="sheet-backdrop" @click=${(m) => m.target === m.currentTarget && r()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit interaction" : "Log interaction"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${r}>Cancel</button>
        <span class="title" style="text-align:center">${n ? "Edit" : "Log"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!d || t.busy} @click=${v}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          <div class="field">
            <span>Person</span>
            <div style="display:flex;align-items:center;gap:10px">${C(e.name, e.photo_url, 26)} ${e.name}</div>
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
            <input id="log-summary" class="input" maxlength="300" aria-invalid=${u("summary") ? "true" : "false"}
              .value=${k(s.summary)} @input=${(m) => l({ summary: m.target.value })} />
            ${p("summary")}
          </label>
          <label class="field">
            <span>Notes</span>
            <textarea id="log-notes" class="input" maxlength="20000" aria-invalid=${u("notes") ? "true" : "false"}
              .value=${k(s.notes)} @input=${(m) => l({ notes: m.target.value })}></textarea>
            ${p("notes")}
          </label>
          ${zs(t, i, s, n, e)}
          <a href=${Us} target="_blank" rel="noopener noreferrer" style="display:grid;justify-items:center;gap:8px;padding:8px 0">
            <span class="action primary" style="width:44px;height:44px;border-radius:50%">${w.mic}</span>
            <span class="muted" style="font-size:11.5px">Or tell Claude about it, and it logs it in Hearth for you.</span>
          </a>
        </div>
      </div>
    </div>
  </div>`;
}
function zs(t, e, n, i, s) {
  if (i) return h;
  const a = (p) => t.drafts.patch(e, { reminder: p });
  if (!n.reminder) return o`<button class="btn secondary" @click=${() => a({ ...In(), person: s.id })}>Add reminder</button>`;
  const { people: r, today: l, reminder_units: c } = $(t), d = Hs(V(t, e), "reminder"), u = r.find((p) => p.id === n.reminder?.person);
  return o`<div class="label">Reminder</div>
    ${me(t, {
    id: "log-reminder-person",
    label: "For",
    path: f.logInteraction(s.id),
    selected: u ? [u.id] : [],
    onPick: (p) => d.set("person", p),
    onRemove: () => d.set("person", ""),
    disabled: t.busy
  })}
    ${On(d, l, c, t.busy)}
    <button class="btn secondary" @click=${() => a(null)}>Remove reminder</button>`;
}
function Un(t, e, n, i) {
  const s = e.state !== "done", a = s ? Pn(e, n) : "Done", r = e.repeat_every && e.repeat_unit ? ` · ${At(e.repeat_every, e.repeat_unit)}` : "";
  return o`<div class="row reminder-row">
    ${i ? C(i.name, i.photo_url) : h}
    <a class="main" href=${f.reminder(e.id)}>
      ${i ? o`<div class="sub">${i.name}</div>` : h}
      <div class="name">${e.note || "Reminder"}</div>
      <div class="sub" style=${e.state === "overdue" ? "color:var(--danger)" : ""}>${a}${r}</div>
    </a>
    ${s ? o`<button class="pill" aria-label=${`Done: ${e.note || "Reminder"}`} ?disabled=${t.busy} @click=${() => void t.completeReminder(e.id)}>Done</button>` : h}
  </div>`;
}
function Ln(t, e, n, i) {
  if (!e.length) return h;
  const { today: s } = $(t);
  return o`<div class="label" style=${n}>Reminders</div>
    <div class="card" style=${i}>${e.map((a) => Un(t, a, s))}</div>`;
}
function Gs(t, e, n) {
  return [
    n ? { icon: w.pencil, label: "Edit", href: f.editInteraction(e.id) } : { icon: w.pencil, label: "Edit", disabled: !0 },
    {
      icon: w.trash,
      label: "Delete interaction",
      onClick: () => t.drafts.put(St(e.id), f.interaction(e.id), {})
    }
  ];
}
const St = (t) => `confirm-delete:interaction:${t}`;
function Fs(t, e, n) {
  const i = St(e.id);
  return M({
    title: "Delete this interaction?",
    lines: [`“${e.summary}” on ${kn(e.date)} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(i),
    onConfirm: async () => {
      await t.deleteInteraction(e.id) && (t.drafts.drop(i), O(n ? f.person(n.id) : f.home()));
    }
  });
}
function zn(t, e, n) {
  const { interactions: i, people: s, reminders: a } = $(t), r = i.find((d) => d.id === e);
  if (!r) return G("interaction");
  const l = Ue(r, s), c = l[0];
  return {
    title: null,
    back: !0,
    actions: Gs(t, r, c),
    body: o`<div class="page" style="padding:20px;display:grid;gap:18px">
      ${l.length ? o`<div style="display:grid;gap:12px">
            ${l.length > 1 ? o`<div class="label">People</div>` : h}
            ${l.map(
      (d) => o`<a href=${f.person(d.id)} style="display:flex;align-items:center;gap:12px">
                ${C(d.name, d.photo_url)}<span class="accent" style="font-weight:600;font-size:15px">${d.name}</span>
              </a>`
    )}
          </div>` : h}
      <div>
        <div class="label">${kn(r.date)}</div>
        <div class="mono accent" style="font-size:10.5px">${r.type}</div>
      </div>
      <div class="h-serif" style="font-size:19px">${r.summary}</div>
      ${r.notes ? o`<div><div class="label" style="margin-bottom:6px">Notes</div><div style="white-space:pre-wrap">${r.notes}</div></div>` : h}
      <div>
        ${Ln(t, a.filter((d) => d.interaction_id === r.id), "margin-bottom:6px", "margin:0;padding:0")}
        <a class="accent" href=${f.newInteractionReminder(r.id)} style="display:block;font-size:12.5px;padding:8px 0">Add reminder</a>
      </div>
    </div>`,
    overlay: o`${n === "edit" && c ? Hn(t, c, r) : h}${t.drafts.get(St(e)) ? Fs(t, r, c) : h}`
  };
}
const Gn = "That file isn't a photo Hearth can use.", Bs = 4e6;
class ie extends Error {
  constructor(e = Gn) {
    super(e), this.name = "PhotoUnusable";
  }
}
const Fn = {
  decode: (t) => createImageBitmap(t, { imageOrientation: "from-image" }),
  async encode(t, e, n, i) {
    const s = t;
    if (typeof OffscreenCanvas < "u") {
      const r = new OffscreenCanvas(e, n);
      return Qt(r.getContext("2d"), s, e, n), r.convertToBlob({ type: "image/jpeg", quality: i });
    }
    const a = document.createElement("canvas");
    return a.width = e, a.height = n, Qt(a.getContext("2d"), s, e, n), new Promise(
      (r, l) => a.toBlob((c) => c ? r(c) : l(new Error("encoding failed")), "image/jpeg", i)
    );
  }
};
function Qt(t, e, n, i) {
  if (!t) throw new Error("no 2d canvas");
  t.fillStyle = "white", t.fillRect(0, 0, n, i), t.drawImage(e, 0, 0, n, i);
}
function js(t) {
  let e = "";
  for (let i = 0; i < t.length; i += 32768) e += String.fromCharCode(...t.subarray(i, i + 32768));
  return btoa(e);
}
async function Vs(t, e = 1024, n = 0.85, i = Fn) {
  let s;
  try {
    s = await i.decode(t);
  } catch {
    throw new ie();
  }
  try {
    const { width: a, height: r } = s;
    if (!(a > 0 && r > 0)) throw new ie();
    const l = Math.min(1, e / Math.max(a, r)), c = Math.max(1, Math.round(a * l)), d = Math.max(1, Math.round(r * l));
    let u;
    try {
      u = await i.encode(s, c, d, n);
    } catch {
      throw new ie();
    }
    let p;
    try {
      p = js(new Uint8Array(await u.arrayBuffer()));
    } catch {
      throw new ie();
    }
    if (p.length > Bs) throw new ie();
    return p;
  } finally {
    s.close?.();
  }
}
async function qs(t, e, n, i, s = Fn) {
  if (t.shrinkingPhoto) return !1;
  let a;
  t.setShrinkingPhoto(!0);
  try {
    a = await Vs(i, 1024, 0.85, s);
  } catch {
    return t.showToast(Gn), !1;
  } finally {
    t.setShrinkingPhoto(!1);
  }
  return t.setPhoto(e, n, a);
}
function Bn(t, e, n, i) {
  return o`<input class="file-input" type="file" accept="image/*" ?disabled=${i} @change=${(a) => {
    const r = a.target, l = r.files?.[0];
    r.value = "", l && qs(t, e, n, l);
  }} />`;
}
const jn = (t) => t.busy || t.shrinkingPhoto;
function Tt(t, e) {
  const { kind: n, id: i, name: s, photoUrl: a } = e, r = jn(t);
  return o`<div class="photo-picker">
    ${C(s, a, 76)}
    <div class="actions">
      <label class="btn secondary file-btn" aria-disabled=${r ? "true" : "false"}>
        ${t.shrinkingPhoto ? "Preparing photo…" : a ? "Change photo" : "Add photo"} ${Bn(t, n, i, r)}
      </label>
      ${a ? o`<button class="btn secondary" ?disabled=${r} @click=${() => void t.clearPhoto(n, i)}>Remove photo</button>` : h}
    </div>
  </div>`;
}
function Ks(t, e, n = 76) {
  const { kind: i, id: s, name: a, photoUrl: r } = e, l = jn(t), c = r ? "Change photo" : "Add photo";
  return o`<label class="file-btn photo-tap" aria-label=${c} title=${c} aria-disabled=${l ? "true" : "false"}>
    ${C(a, r, n)} ${Bn(t, i, s, l)}
  </label>`;
}
function Rt(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const a of e) n.has(a.id) || n.set(a.id, a);
  const i = /* @__PURE__ */ new Set(), s = [];
  for (const a of t) {
    if (i.has(a)) continue;
    i.add(a);
    const r = n.get(a);
    r && s.push(r);
  }
  return s.sort(nt);
}
const Vn = (t) => `edit:group:${t}`, be = "edit:group:new", rt = (t) => `confirm-delete:group:${t}`, Ke = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`;
function qn(t, e, n) {
  const i = V(t, e), s = { ...i, error: (a) => a === "name" && n ? "Enter a name." : i.error(a) };
  return o`${N(s, "name", "Name", { required: !0, maxlength: 200 })}
  ${X(s, "description", "Description", 2e4)}`;
}
function Ys(t) {
  const n = !t.drafts.open(be, f.newGroup(), () => ({ name: "", description: "" })).name.trim(), i = async () => {
    const s = t.drafts.get(be);
    if (!s || !s.name.trim()) return;
    const a = await t.save("contact_group", null, { ...s });
    a && (t.drafts.drop(be), z(f.editGroup(a.id), !0));
  };
  return {
    title: "New group",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${qn(t, be, n)}
      <button class="btn" ?disabled=${n || t.busy} @click=${i}>Create group</button>
    </div>`
  };
}
function Ws(t, e) {
  const n = Rt(e.member_ids, $(t).people);
  return me(t, {
    id: "group-members",
    label: "Add a member",
    path: f.editGroup(e.id),
    selected: n.map((i) => i.id),
    // Built from store.groupMembers, so a change made before the last one reaches the snapshot isn't undone.
    onPick: (i) => void t.setGroupMembers(e.id, [...t.groupMembers(e.id).filter((s) => s !== i), i]),
    onRemove: (i) => void t.setGroupMembers(e.id, t.groupMembers(e.id).filter((s) => s !== i)),
    disabled: t.busy
  });
}
function Js(t, e) {
  const n = rt(e.id), i = e.member_ids.length;
  return M({
    title: `Delete ${e.name}?`,
    lines: [`${i} ${i === 1 ? "person stays" : "people stay"}; they just leave this group.`, "This can't be undone."],
    confirmLabel: "Delete group",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("contact_group", e.id) && (t.drafts.drop(n), t.drafts.drop(Vn(e.id)), t.setSearch({ chip: "groups" }), z(f.search(), !0));
    }
  });
}
function Xs(t, e) {
  const n = $(t).groups.find((c) => c.id === e);
  if (!n) return t.isArriving(e) ? pe : G("group");
  const i = Vn(e), s = f.editGroup(e), r = !t.drafts.open(i, s, () => ({ name: n.name, description: n.description ?? "" })).name.trim(), l = async () => {
    const c = t.drafts.get(i), d = t.drafts.base(i);
    !c || !d || !c.name.trim() || await t.save("contact_group", e, { ...c }, { ...d }) && (t.drafts.drop(i), O(f.group(e)));
  };
  return {
    title: "Edit group",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${Ke("Photo", Tt(t, { kind: "contact_group", id: e, name: n.name, photoUrl: n.photo_url }))}
      ${Ke("Details", qn(t, i, r))}
      <button class="btn" ?disabled=${r || t.busy} @click=${l}>Save</button>
      ${Ke("Members", Ws(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(rt(e), s, {})}>
        Delete group
      </button>
    </div>`,
    overlay: t.drafts.get(rt(e)) ? Js(t, n) : void 0
  };
}
const Kn = (t) => ({
  name: t.trim(),
  phone: null,
  email: null,
  how_i_know_them: null,
  birthday: null,
  birth_year_unknown: !1
}), Zs = "Name (leave blank to use the generated name)", Yn = (t) => `edit:household:${t}`, $e = "edit:household:new", Ge = (t) => `confirm-delete:household:${t}`, Fe = (t) => `confirm-dissolve:household:${t}`, Be = (t) => `confirm-move:household:${t}`, Ye = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`, ot = (t) => ({ name_override: t.name_override, address: t.address, notes: t.notes });
function Wn(t, e) {
  const n = N(t, "name_override", Zs, { maxlength: 200 });
  return o`${e ? o`<div class="highlight">${n}</div>` : n} ${it(t, "address", "Address")}
  ${X(t, "notes", "Notes", 2e4)}`;
}
function Qs(t) {
  const e = f.newHousehold();
  t.drafts.open($e, e, () => ({ name_override: "", address: "", notes: "" }));
  const n = async () => {
    const i = t.drafts.get($e);
    if (!i) return;
    const s = await t.save("household", null, ot(i));
    s && (t.drafts.drop($e), z(f.editHousehold(s.id), !0));
  };
  return {
    title: "New household",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${Wn(V(t, $e), !1)}
      <button class="btn" ?disabled=${t.busy} @click=${n}>Create household</button>
    </div>`
  };
}
function ea(t, e) {
  const n = f.editHousehold(e.id);
  let i = h;
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
          @click=${() => t.drafts.put(Fe(e.id), n, {})}
        >
          Dissolve household
        </button>`;
      break;
  }
  return o`<div style="display:grid;gap:6px">
    <div class="h-serif members-title ${Z(e) ? "" : "muted"}" style="font-size:21px">${D(e)}</div>
    ${i}
  </div>`;
}
const lt = (t, e, n) => t.save("person", e, { household_id: n });
function ta(t, e) {
  const { people: n, relationships: i } = $(t), s = kt(Rt(e.member_ids, n), e.member_ids, i, (l) => l), a = f.editHousehold(e.id), r = (l) => {
    const c = n.find((d) => d.id === l);
    if (c?.household_id && c.household_id !== e.id) {
      t.drafts.put(Be(e.id), a, { personId: l });
      return;
    }
    lt(t, l, e.id);
  };
  return me(t, {
    id: "household-members",
    label: "Add a member",
    path: a,
    selected: s.map((l) => l.id),
    onPick: r,
    onRemove: (l) => void lt(t, l, null),
    // A new person goes straight into this household, so they needn't be in the snapshot first.
    onCreate: (l) => void t.addPerson({ ...Kn(l), household_id: e.id }),
    disabled: t.busy
  });
}
function na(t, e, n) {
  const i = Be(e.id), s = $(t), a = s.households.find((l) => l.id === n.household_id), r = a ? _t(a, s.people) : "their household";
  return M({
    title: `Move ${n.name} from ${r} to this household?`,
    lines: ["A person can only be in one household."],
    confirmLabel: "Move",
    busy: t.busy,
    onCancel: () => t.drafts.drop(i),
    onConfirm: async () => {
      await lt(t, n.id, e.id) && t.drafts.drop(i);
    }
  });
}
const ia = (t) => `${t} ${t === 1 ? "person stays" : "people stay"}; they just won't have a household.`;
function Jn(t, e) {
  for (const n of [Yn(e), Ge(e), Fe(e), Be(e)]) t.drafts.drop(n);
  t.setSearch({ chip: "households" }), z(f.search(), !0);
}
function sa(t, e) {
  const n = Ge(e.id);
  return M({
    title: `Delete ${D(e)}?`,
    lines: [ia(e.member_ids.length), "This can't be undone."],
    confirmLabel: "Delete household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && Jn(t, e.id);
    }
  });
}
function aa(t, e) {
  const n = Fe(e.id);
  return M({
    title: "Dissolve this household?",
    lines: ["Members stay; they just won't have a household."],
    confirmLabel: "Dissolve household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && Jn(t, e.id);
    }
  });
}
function ra(t, e) {
  const n = e.id;
  if (t.drafts.get(Ge(n))) return sa(t, e);
  if (t.drafts.get(Fe(n))) return aa(t, e);
  const i = t.drafts.get(Be(n)), s = i && $(t).people.find((a) => a.id === i.personId);
  return s ? na(t, e, s) : void 0;
}
function oa(t, e) {
  const n = $(t).households.find((r) => r.id === e);
  if (!n) return t.isArriving(e) ? pe : G("household");
  const i = Yn(e), s = f.editHousehold(e);
  t.drafts.open(i, s, () => ({
    name_override: n.name_override ?? "",
    address: n.address?.formatted ?? "",
    notes: n.notes ?? ""
  }));
  const a = async () => {
    const r = t.drafts.get(i), l = t.drafts.base(i);
    !r || !l || await t.save("household", e, ot(r), ot(l)) && (t.drafts.drop(i), O(f.household(e)));
  };
  return {
    title: "Edit household",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${ea(t, n)}
      ${Ye("Photo", Tt(t, { kind: "household", id: e, name: D(n), photoUrl: n.photo_url }))}
      ${Ye("Details", Wn(V(t, i), n.name_status === "needs_name"))}
      <button class="btn" ?disabled=${t.busy} @click=${a}>Save</button>
      ${Ye("Members", ta(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(Ge(e), s, {})}>
        Delete household
      </button>
    </div>`,
    overlay: ra(t, n)
  };
}
function Xn(t, e, n, i) {
  const { people: s, relationships: a } = $(t), r = Rt(n, s), l = i ? kt(r, n, a, (c) => c) : r;
  return {
    title: null,
    back: !0,
    actions: [{ icon: w.pencil, label: "Edit", href: e.editHref }],
    body: o`<div class="page">
      <div style="padding:16px">
        <div class="h-serif members-title ${e.muted ? "muted" : ""}" style="font-size:21px">${e.title}</div>
        ${e.subtitle ? o`<div class="muted" style="font-size:12.5px;margin-top:4px">${e.subtitle}</div>` : h}
        ${e.prompt ? o`<a class="warning name-prompt" style="display:block;font-size:12.5px;margin-top:4px" href=${e.prompt.href}>${e.prompt.text}</a>` : h}
        <!-- The members actually shown, not the raw id count. -->
        <div class="label" style="margin-top:6px">${Oe(l.length, "member").toUpperCase()}</div>
      </div>
      <div class="list">${l.map((c) => tt(c))}</div>
    </div>`
  };
}
function la(t, e) {
  const n = $(t).households.find((r) => r.id === e);
  if (!n) return G("household");
  const i = f.editHousehold(e), s = n.name_status === "needs_name" ? { text: "This household needs a name. Name it", href: i } : n.name_status === "not_a_household" ? { text: "This isn't a household any more. Review it", href: i } : null, a = { title: D(n), muted: !Z(n), subtitle: null, prompt: s, editHref: i };
  return Xn(t, a, n.member_ids, !0);
}
function ca(t, e) {
  const n = $(t).groups.find((i) => i.id === e);
  return n ? Xn(t, { title: n.name, muted: !1, subtitle: n.description, prompt: null, editHref: f.editGroup(e) }, n.member_ids, !1) : G("group");
}
function Zn(t) {
  if (!t) return null;
  if (t.startsWith("+")) {
    const n = t.slice(1).replace(/\D/g, "");
    return n.length >= 8 ? `+${n}` : null;
  }
  const e = t.replace(/\D/g, "");
  return e.length === 10 ? `+1${e}` : e.length === 11 && e.startsWith("1") ? `+${e}` : null;
}
function da(t) {
  const e = Zn(t);
  return e ? `tel:${e}` : null;
}
function ha(t) {
  const e = Zn(t);
  return e ? `sms:${e}` : null;
}
function ua(t) {
  const e = t?.trim() ?? "";
  return e === "" || /\s/.test(e) ? null : `mailto:${e}`;
}
function en(t) {
  return t ? typeof t.lat == "number" && typeof t.lon == "number" ? !0 : (t.formatted?.trim() ?? "") !== "" : !1;
}
function pa(t, e) {
  return en(t.address) ? t.address : en(e?.address) ? e.address : null;
}
function fa(t, e) {
  const n = pa(t, e);
  if (!n) return null;
  const i = n.formatted ?? "";
  return typeof n.lat == "number" && typeof n.lon == "number" ? `https://maps.apple.com/?ll=${n.lat},${n.lon}&q=${encodeURIComponent(i)}` : i ? `https://maps.apple.com/?q=${encodeURIComponent(i)}` : null;
}
function _e(t) {
  const e = t?.trim() ?? "";
  if (!e) return null;
  try {
    const n = new URL(e);
    return n.protocol === "http:" || n.protocol === "https:" ? n.href : null;
  } catch {
    return null;
  }
}
const ma = "/config/integrations/integration/hearth_crm", Qn = "contact missing", ei = "create uncertain", Ee = "confirm-google-enable", Se = "confirm-google-clear";
function ti(t) {
  switch (t) {
    case Qn:
      return "This contact was deleted in Google.";
    case ei:
      return "Hearth couldn't confirm whether Google created this contact.";
    default:
      return t;
  }
}
function ni(t) {
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
function ga(t) {
  const e = new Date(t);
  return Number.isNaN(e.getTime()) ? t : e.toLocaleString();
}
function ii(t) {
  const e = [`${t.created} created`, `${t.updated} updated`];
  return t.photos && e.push(`${t.photos} photos`), t.errors && e.push(`${t.errors} with errors`), t.missing && e.push(`${t.missing} missing in Google`), t.pending && e.push(`${t.pending} still to do`), e.join(", ");
}
function va() {
  return o`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">
      Hearth can keep your contacts in your Google account up to date. It's optional, and Hearth works the same without it.
    </div>
    <div class="muted" style="font-size:12.5px">
      To connect: Settings → Devices & services → Hearth → Reconfigure.
    </div>
    <a class="accent" style="font-size:12.5px" href=${ma} target="_blank" rel="noopener noreferrer">Open Hearth in Home Assistant</a>
  </div>`;
}
function ya(t) {
  const { counts: e, last_run: n } = t, i = n ? ni(n) : null;
  return o`<div id="google-status" style="display:grid;gap:4px;font-size:12.5px">
    <div>
      ${e.synced} synced, ${e.pending} waiting, ${e.skipped} skipped${e.missing ? o`, ${e.missing} missing in Google` : h}${e.errors ? o`, ${e.errors} with errors` : h}
    </div>
    ${t.running ? o`<div class="muted">Syncing now…</div>` : h}
    ${n && !n.dry_run ? o`<div class="muted">Last run ${ga(n.started_at)}: ${ii(n)}</div>` : o`<div class="muted">No sync has run yet.</div>`}
    ${i ? o`<div role="alert">${i}</div>` : h}
    ${t.last_error ? o`<div role="alert">The last run failed: ${t.last_error}</div>` : h}
  </div>`;
}
function ba(t, e) {
  const n = !e.cutover_confirmed && !e.enabled, i = (s) => {
    const a = s.target;
    a.checked ? (a.checked = !1, t.drafts.put(Ee, f.settings(), {})) : t.setGoogleEnabled(!1);
  };
  return o`<div style="display:grid;gap:4px">
    <label class="check">
      <input
        id="google-enable"
        type="checkbox"
        role="switch"
        ?disabled=${n || t.busy}
        aria-describedby=${n ? "google-enable-why" : h}
        .checked=${k(e.enabled)}
        @change=${i}
      />
      <span>Keep Google Contacts up to date</span>
    </label>
    ${n ? o`<div class="muted" id="google-enable-why" style="font-size:12.5px">
          Available once cutover is confirmed, so test edits in Hearth never reach your Google account. Run the Hearth “Confirm cutover” action (Developer tools → Actions) once your import is final. You can still preview below.
        </div>` : h}
  </div>`;
}
function $a(t) {
  const e = t.created - t.would_create.length;
  return o`<div id="google-preview" role="status" style="display:grid;gap:6px;font-size:12.5px">
    <div>
      Would create ${t.created}, update ${t.updated}, skip ${t.skipped}${t.photos ? `, and ${t.photos} ${t.photos === 1 ? "photo" : "photos"} to upload` : h}
    </div>
    ${t.would_create.length ? o`<div class="muted">Would create:</div>
          <ul style="margin:0;padding-left:18px">
            ${t.would_create.map((n) => o`<li>${n}</li>`)}
          </ul>
          ${e > 0 ? o`<div class="muted" id="google-preview-more">and ${e} more</div>` : h}` : h}
  </div>`;
}
function _a(t) {
  const e = ni(t);
  return o`<div id="google-sync-result" role="status" style="display:grid;gap:4px;font-size:12.5px">
    <div>Sync finished: ${ii(t)}</div>
    ${e ? o`<div>${e}</div>` : h}
  </div>`;
}
function wa(t) {
  return $(t).people.filter((e) => e.google_sync_error);
}
function xa(t) {
  const e = wa(t);
  return e.length ? o`<div id="google-problems" style="display:grid;gap:10px">
    <div class="label" style="padding:0">Needs attention</div>
    ${e.map((n) => {
    const i = n.google_sync_error, s = i === ei && !n.google_contact_id, a = s || i === Qn && !!n.google_contact_id;
    return o`<div class="google-problem" style="display:flex;align-items:center;gap:10px">
        <span style="flex:1;min-width:0">
          <a href=${f.person(n.id)} style="font-weight:600">${n.name}</a>
          <div class="muted" style="font-size:12.5px">${ti(i)}</div>
        </span>
        ${a ? o`<button
              class="btn secondary"
              ?disabled=${t.busy}
              @click=${() => t.drafts.put(Se, f.settings(), { personId: n.id, uncertain: s })}
            >
              Create a new contact
            </button>` : h}
      </div>`;
  })}
  </div>` : h;
}
function ka(t) {
  const { status: e, loadError: n, preview: i, lastSync: s, working: a } = t.google;
  return e ? e.connected ? o`<div class="card" style="padding:13px;display:grid;gap:12px">
    ${n ? o`<div class="muted" id="google-refresh-error" role="status" style="font-size:12.5px">Couldn't refresh Google status</div>` : h}
    ${ya(e)} ${ba(t, e)}
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
    ${i ? $a(i) : h} ${s ? _a(s) : h} ${xa(t)}
  </div>` : va() : o`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${n ? `Couldn't load the Google sync status: ${n}` : "Loading…"}</div>
    </div>`;
}
function Ca(t) {
  if (t.drafts.get(Ee))
    return M({
      title: "Turn on Google sync?",
      lines: ["Contacts will be created and updated in your Google account. Hearth never deletes a Google contact."],
      confirmLabel: "Turn on",
      busy: t.busy,
      onCancel: () => t.drafts.drop(Ee),
      onConfirm: () => {
        t.drafts.drop(Ee), t.setGoogleEnabled(!0);
      }
    });
  const e = t.drafts.get(Se);
  if (e)
    return M({
      title: "Create a new contact?",
      lines: [
        e.uncertain ? "Hearth couldn't confirm whether Google created this contact. Check Google Contacts for a stray copy first; a new one will be created." : "A new contact will be created in Google. The old one is not touched."
      ],
      confirmLabel: "Create new contact",
      busy: t.busy,
      onCancel: () => t.drafts.drop(Se),
      onConfirm: () => {
        t.drafts.drop(Se), t.clearGoogleContact(e.personId);
      }
    });
}
function we(t, e, n) {
  return o`<a class="action" href=${n} target="_blank" rel="noopener noreferrer" aria-label=${e} title=${e}
    >${t}</a
  >`;
}
function Aa(t, e) {
  const n = da(t.phone), i = ha(t.phone), s = ua(t.email), a = fa(t, e);
  return o`<div class="actions-row">
    <a class="action primary" href=${f.logInteraction(t.id)} aria-label="Log interaction" title="Log interaction"
      >${w.plus}</a
    >
    <a class="action" href=${f.newReminder(t.id)} aria-label="Add reminder" title="Add reminder">${w.bell}</a>
    ${n ? we(w.phone, "Call", n) : h} ${i ? we(w.message, "Message", i) : h}
    ${s ? we(w.envelope, "Email", s) : h} ${a ? we(w.mapPin, "Map", a) : h}
  </div>`;
}
function Ea(t, e) {
  const n = e.person;
  return o`<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
    <a class="connection" href=${f.person(n.id)} style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
      ${C(n.name, n.photo_url, 28)}
      <span style="flex:1;font-weight:600;font-size:13px">${n.name}</span>
    </a>
    ${e.connectionType && e.relationshipId ? o`<a
          class="connection-type mono muted"
          style="font-size:9px;padding:6px 0 6px 8px"
          href=${f.relationship(t, e.relationshipId)}
          aria-label=${`Edit relationship with ${n.name}`}
          >${e.connectionType.toUpperCase()}</a
        >` : h}
  </div>`;
}
const tn = o`<div style="border-top:1px solid var(--border);margin:9px 0"></div>`;
function Sa(t) {
  const e = Z(t);
  return o`<a href=${f.household(t.id)} style="display:flex;justify-content:space-between;padding-bottom:2px">
    <span class="mono household-name ${e ? "accent" : "muted"}" style="font-size:9.5px"
      >${e ? D(t).toUpperCase() : D(t)}</span
    >
    <span class="mono muted" style="font-size:9px">HOUSEHOLD</span>
  </a>`;
}
function Ta(t, e) {
  const { people: n, households: i, groups: s, relationships: a, me_person_id: r } = e, l = Cs(t.id, { people: n, households: i, groups: s, relationships: a, excludedId: r }), c = (u) => Ea(t.id, u), d = o`<a class="accent add-relationship" href=${f.newRelationship(t.id)} style="display:block;font-size:12.5px;padding:8px 20px 18px"
    >Add relationship</a
  >`;
  return ks(l) ? o`<div class="label" style="padding:0 20px 8px">Connections</div>${d}` : o`<div class="label" style="padding:0 20px 8px">Connections</div>
    <div class="card">
      ${l.household ? o`${Sa(l.household)} ${l.householdMembers.map(c)}` : h}
      ${l.others.length ? o`${l.household ? o`${tn}<div class="mono muted" style="font-size:9.5px">ELSEWHERE</div>` : h}
          ${l.others.map(c)}` : h}
      ${l.groups.length ? o`${l.household || l.others.length ? tn : h}
            <div class="mono muted" style="font-size:9.5px;padding-bottom:5px">GROUPS</div>
            <div class="chips">
              ${l.groups.map(
    (u) => o`<a class="chip" href=${f.group(u.id)}
                    >${u.name}<span class="mono muted" style="font-size:8.5px">${u.member_ids.length}</span></a
                  >`
  )}
            </div>` : h}
    </div>
    ${d}`;
}
function Ra(t) {
  const n = [
    [_e(t.website), w.globe, "Website"],
    [_e(t.linkedin), w.linkedIn, "LinkedIn profile"],
    [_e(t.facebook), w.facebook, "Facebook profile"],
    [_e(t.instagram), w.instagram, "Instagram profile"]
  ].filter(([i]) => i);
  return n.length ? o`<div style="display:flex;gap:14px;padding:0 20px 18px">
    ${n.map(
    ([i, s, a]) => o`<a class="accent" style="width:22px;height:22px;display:inline-flex" href=${i ?? ""} target="_blank" rel="noopener noreferrer" aria-label=${a} title=${a}
          >${s}</a
        >`
  )}
  </div>` : h;
}
function Na(t) {
  return t.length ? o`<div class="label" style="padding:0 20px 8px">Timeline</div>
    <div style="display:grid;gap:16px;padding:0 20px 20px">
      ${t.map(
    (e) => o`<a href=${f.interaction(e.id)} style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:11px;height:11px;border:2px solid var(--accent);border-radius:50%;margin-top:3px;flex:none"></span>
          <span>
            <div class="mono muted" style="font-size:9.5px">${Xi(e.date).toUpperCase()} · ${e.type.toUpperCase()}</div>
            <div style="font-weight:600;font-size:13px">${e.summary}</div>
          </span>
        </a>`
  )}
    </div>` : h;
}
function Nt(t, e, n) {
  const i = $(t), s = i.people.find((c) => c.id === e);
  if (!s) return t.isArriving(e) ? pe : G("person");
  const a = s.household_id ? i.households.find((c) => c.id === s.household_id) ?? null : null, r = [s.occupation, s.employer].filter(Boolean).join(" - "), l = s.how_i_know_them?.trim();
  return {
    title: null,
    back: !0,
    actions: [
      { icon: w.pencil, label: "Edit", href: f.editPerson(s.id) },
      {
        icon: s.favorite ? w.starFill : w.star,
        label: s.favorite ? "Remove from favorites" : "Add to favorites",
        className: s.favorite ? "accent" : "muted",
        onClick: () => void t.toggleFavorite(s)
      }
    ],
    body: o`<div class="page">
      <div style="display:grid;justify-items:center;gap:6px;padding:8px 20px 18px;text-align:center">
        ${Ks(t, { kind: "person", id: s.id, name: s.name, photoUrl: s.photo_url })}
        <div class="h-serif" style="font-size:21px">${s.name}</div>
        ${r ? o`<div class="muted" style="font-size:12.5px">${r}</div>` : h}
        ${l ? o`<div class="muted" style="font-size:12.5px">${l}</div>` : h}
        ${s.birthday ? o`<div class="muted" style="font-size:12.5px">${Zi(s.birthday, s.birth_year_unknown, s.age)}</div>` : h}
        ${s.close_friend ? o`<div class="mono accent" style="font-size:10px;padding:4px 12px;border:1px dashed var(--thread);border-radius:999px;margin-top:4px">
              ◆ Close Friend rotation
            </div>` : h}
      </div>
      ${s.google_sync_error ? o`<a class="notice google-error" href=${f.settings()} style="display:block">Google sync: ${ti(s.google_sync_error)}</a>` : h}
      ${Aa(s, a)}
      ${s.relationship_summary ? o`<div class="label" style="padding:0 20px 8px">Relationship summary</div>
            <div class="card" style="border-left:3px solid var(--accent);padding:14px;font-size:12.5px;white-space:pre-wrap">${s.relationship_summary}</div>` : h}
      ${Ln(t, i.reminders.filter((c) => c.person_id === s.id && c.state !== "done"), "padding:0 20px 8px", "padding:0")}
      ${Ta(s, i)} ${Ra(s)} ${Na(fs(i.interactions, s.id))}
    </div>`,
    overlay: n === "log" ? Hn(t, s, null) : void 0
  };
}
const ct = "new", si = [
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
], Ma = ["favorite", "close_friend"], Mt = (t) => `edit:person:${t}`, dt = (t) => `confirm-delete:person:${t}`;
function Pa(t, e) {
  return t.groups.filter((n) => n.member_ids.includes(e)).map((n) => n.id);
}
function Ia(t, e) {
  return {
    ...Object.fromEntries(si.map((i) => [i, t[i] ?? ""])),
    favorite: t.favorite,
    close_friend: t.close_friend,
    birthday: t.birthday ?? "",
    birth_year_unknown: t.birth_year_unknown,
    address: t.address?.formatted ?? "",
    school: t.school?.formatted ?? "",
    household_id: t.household_id ?? "",
    group_ids: Pa(e, t.id),
    saving: !1
  };
}
function nn(t, e) {
  const n = {};
  for (const i of si) n[i] = t[i];
  for (const i of Ma) n[i] = t[i];
  return n.birthday = t.birthday, n.birth_year_unknown = t.birthday !== "" && t.birth_year_unknown, n.address = t.address, n.school = t.school, n.household_id = e, n;
}
function Da(t, e) {
  const n = t.relationships.filter((d) => d.person_a_id === e || d.person_b_id === e).length, i = t.groups.filter((d) => d.member_ids.includes(e)).length, s = t.interactions.filter((d) => d.person_ids.includes(e)), a = s.filter((d) => d.person_ids.every((u) => u === e)).length, r = s.length - a, l = t.reminders.filter((d) => d.person_id === e).length, c = (d, u, p) => `${d} ${d === 1 ? u : p}`;
  return `Also removes ${c(n, "relationship", "relationships")} and ${c(i, "group membership", "group memberships")}. ${c(a, "interaction with only them is", "interactions with only them are")} deleted; ${c(r, "shared interaction keeps", "shared interactions keep")} the other people.` + (l ? ` ${c(l, "reminder about them is", "reminders about them are")} deleted.` : "");
}
function Oa(t, e) {
  const n = e.household_id ? t.households.find((i) => i.id === e.household_id) : void 0;
  return n ? [`They leave ${_t(n, t.people)}.`] : [];
}
function Ha(t, e) {
  const n = dt(e.id), i = $(t);
  return M({
    title: `Delete ${e.name}?`,
    lines: [Da(i, e.id), ...Oa(i, e), "This can't be undone."],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("person", e.id) && (t.drafts.drop(n), t.drafts.drop(Mt(e.id)), z(f.home(), !0));
    }
  });
}
async function Ua(t, e) {
  const n = Mt(e.id), i = t.drafts.get(n), s = t.drafts.base(n);
  if (!(!i || !s || i.saving || !i.name.trim())) {
    t.drafts.patch(n, { saving: !0 });
    try {
      let a = i.household_id || null;
      if (a === ct) {
        const l = await t.save("household", null, {});
        if (!l) return;
        a = l.id, t.drafts.patch(n, { household_id: a });
      }
      const r = nn(s, s.household_id || null);
      if (!await t.save("person", e.id, nn(i, a), r)) return;
      for (const l of $(t).groups) {
        const c = i.group_ids.includes(l.id);
        if (s.group_ids.includes(l.id) === c) continue;
        const d = t.groupMembers(l.id);
        if (d.includes(e.id) === c) continue;
        const u = c ? [...d, e.id] : d.filter((p) => p !== e.id);
        if (!await t.setGroupMembers(l.id, u)) return;
      }
      t.drafts.drop(n), O(f.person(e.id));
    } finally {
      t.drafts.patch(n, { saving: !1 });
    }
  }
}
const P = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`;
function La(t, e) {
  const n = t.households.map((i) => ({ value: i.id, label: _t(i, t.people) })).sort((i, s) => L(i.label, s.label));
  return e && e !== ct && !n.some((i) => i.value === e) && n.push({ value: e, label: "New household" }), [{ value: "", label: "None" }, ...n, { value: ct, label: "New household…" }];
}
function za(t, e, n, i) {
  if (!n.groups.length) return o`<div class="muted" style="font-size:12.5px">No groups yet.</div>`;
  const s = [...n.groups].sort((r, l) => L(r.name, l.name)), a = (r, l) => {
    const c = t.drafts.get(e)?.group_ids ?? [], d = l ? [...c.filter((u) => u !== r), r] : c.filter((u) => u !== r);
    t.drafts.patch(e, { group_ids: d });
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
function Ga(t, e) {
  const n = $(t), i = n.people.find((p) => p.id === e);
  if (!i) return t.isArriving(e) ? pe : G("person");
  const s = Mt(e), a = f.editPerson(e), r = t.drafts.open(s, a, () => Ia(i, n)), l = !r.name.trim(), c = V(t, s), d = { ...c, error: (p) => p === "name" && l ? "Enter a name." : c.error(p) }, u = l || r.saving || t.busy;
  return {
    title: "Edit person",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${P("Photo", Tt(t, { kind: "person", id: e, name: i.name, photoUrl: i.photo_url }))}
      ${P(
      "Basics",
      o`${N(d, "name", "Name", { required: !0, maxlength: 200 })}
        ${N(d, "how_i_know_them", "How I know them", { maxlength: 2e3 })}
        ${N(d, "occupation", "Occupation", { maxlength: 300 })} ${N(d, "employer", "Employer", { maxlength: 300 })}`
    )}
      ${P(
      "Contact",
      o`${N(d, "phone", "Phone", { type: "tel", autocomplete: "tel", maxlength: 50 })}
        ${N(d, "phone2", "Phone 2", { type: "tel", maxlength: 50 })}
        ${N(d, "email", "Email", { type: "email", autocomplete: "email", maxlength: 500 })}
        ${N(d, "email2", "Email 2", { type: "email", maxlength: 500 })}`
    )}
      ${P("Dates", $s(d, "birthday", "Birthday", "birth_year_unknown"))}
      ${P(
      "Flags",
      o`${st(d, "favorite", "Favorite")} ${st(d, "close_friend", "Close friend")}`
    )}
      ${P("Places", o`${it(d, "address", "Address")} ${it(d, "school", "School")}`)}
      ${P(
      "Links",
      o`${ye(d, "website", "Website")} ${ye(d, "linkedin", "LinkedIn")} ${ye(d, "facebook", "Facebook")}
        ${ye(d, "instagram", "Instagram")}`
    )}
      ${P(
      "Notes and summary",
      o`${X(d, "notes", "Notes", 2e4)} ${X(d, "relationship_summary", "Relationship summary", 2e4)}`
    )}
      ${P("Household", xt(d, "household_id", "Household", La(n, r.household_id)))}
      ${P("Groups", za(t, s, n, r.group_ids))}
      <button class="btn" ?disabled=${u} @click=${() => void Ua(t, i)}>Save</button>
      <button
        class="btn danger"
        style="margin-top:24px"
        ?disabled=${t.busy}
        @click=${() => t.drafts.put(dt(e), a, {})}
      >
        Delete person
      </button>
    </div>`,
    overlay: t.drafts.get(dt(e)) ? Ha(t, i) : void 0
  };
}
const Fa = (t, e) => `edit:relationship:${t}:${e ?? "new"}`, ht = (t) => `confirm-delete:relationship:${t}`;
function Ba(t, e, n) {
  const i = Nt(t, e, null), s = $(t), a = s.people.find((c) => c.id === e);
  if (!a) return i;
  let r, l = null;
  return n !== null && (r = s.relationships.find((c) => c.id === n), l = r ? Le(r, e) : null, !r || !l) ? i : { ...i, overlay: ja(t, a, r ?? null, l) };
}
function ja(t, e, n, i) {
  const s = $(t), a = n?.id ?? null, r = Fa(e.id, a), l = n ? f.relationship(e.id, n.id) : f.newRelationship(e.id), c = t.drafts.open(r, l, () => ({
    other: i?.otherId ?? "",
    type: i?.type ?? "",
    notes: n?.notes ?? ""
  })), d = s.people.find((y) => y.id === c.other), u = s.relationships.flatMap((y) => {
    const T = Le(y, e.id);
    return T && T.otherId !== i?.otherId ? [T.otherId] : [];
  }), p = [{ value: "", label: "Choose…" }, ...s.connection_types.map((y) => ({ value: y, label: y }))];
  c.type && !s.connection_types.includes(c.type) && p.push({ value: c.type, label: c.type });
  const v = () => {
    t.drafts.drop(r), O(f.person(e.id));
  }, m = !!d && c.type !== "", g = async () => {
    const y = t.drafts.get(r), T = t.drafts.base(r);
    if (!y || !T || !y.other || !y.type) return;
    const ui = y.other !== T.other || y.type !== T.type, Pt = { person_a_id: e.id, person_b_id: y.other, type: y.type };
    (await t.save(
      "relationship",
      a,
      { ...Pt, notes: y.notes },
      ui ? { notes: T.notes } : { ...Pt, notes: T.notes }
    ) || a && !$(t).relationships.some((pi) => pi.id === a)) && v();
  }, A = V(t, r), b = He(e.name);
  return o`<div class="sheet-backdrop" @click=${(y) => y.target === y.currentTarget && v()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit relationship" : "Add relationship"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${v}>Cancel</button>
        <span class="title" style="text-align:center">${n ? "Relationship" : "Add relationship"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!m || t.busy} @click=${g}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          ${me(t, {
    id: "relationship-person",
    label: "Person",
    path: l,
    exclude: [e.id, ...u],
    selected: d ? [d.id] : [],
    onPick: (y) => t.drafts.patch(r, { other: y }),
    onRemove: () => t.drafts.patch(r, { other: "" }),
    // Just a name: the rest can be filled in from their own screen later.
    onCreate: async (y) => {
      const T = await t.addPerson(Kn(y));
      T && t.drafts.patch(r, { other: T });
    },
    disabled: t.busy
  })}
          <div class="muted" style="font-size:12.5px">${d ? d.name : "Someone"} is ${b}'s</div>
          ${xt(A, "type", "Type", p)} ${X(A, "notes", "Notes", 2e4)}
          ${n ? o`<button
                class="btn danger"
                style="margin-top:12px"
                ?disabled=${t.busy}
                @click=${() => t.drafts.put(ht(n.id), l, {})}
              >
                Remove relationship
              </button>` : h}
        </div>
      </div>
    </div>
  </div>
  ${n && t.drafts.get(ht(n.id)) ? Va(t, e, s.people.find((y) => y.id === i?.otherId), n, v) : h}`;
}
function Va(t, e, n, i, s) {
  const a = ht(i.id), r = n?.name ?? "them";
  return M({
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
function sn(t, e) {
  const n = t.contact_status, i = e ? "var(--danger)" : "var(--warning)";
  return o`<a class="row" href=${f.person(t.id)}>
    <span style="width:3px;height:36px;border-radius:2px;background:${i};flex:none"></span>
    ${C(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${n.last_contacted ? `Last: ${Me(n.last_contacted)}` : "No interactions yet"}</div>
    </span>
    <span class="meta" style="color:${i}">${n.days_since_contact === null ? "—" : `${n.days_since_contact}d`}</span>
  </a>`;
}
const an = (t, e) => (t.contact_status.days_since_contact ?? 1 / 0) - (e.contact_status.days_since_contact ?? 1 / 0), qa = 10;
function Ka(t) {
  const { people: e, reminders: n, today: i } = $(t), { due: s, upcoming: a, someday: r } = Ms(n), l = new Map(e.map((p) => [p.id, p])), c = (p) => p.map((v) => Un(t, v, i, l.get(v.person_id))), d = (p, v) => v.length ? o`<div class="label list-label">${p}</div><div class="list">${c(v)}</div>` : h, u = !s.length && !a.length && !r.length;
  return o`<div style="display:flex;align-items:center;justify-content:space-between;padding-right:16px">
      <div class="label list-label" style="font-size:12px">Reminders</div>
      <a class="pill" href=${f.newReminderAny()}>Add reminder</a>
    </div>
    ${u ? o`<div class="empty">No reminders.</div>` : h}
    ${d("Due", s)} ${d("Upcoming", a.slice(0, qa))}
    ${r.length ? o`<details class="someday">
          <summary class="label list-label">Someday · ${r.length}</summary>
          <div class="list">${c(r)}</div>
        </details>` : h}`;
}
function Te(t) {
  const e = $(t).people.filter((s) => s.close_friend), n = e.filter((s) => s.contact_status.urgency === "overdue").sort(an), i = e.filter((s) => s.contact_status.urgency === "due_soon").sort(an);
  return {
    title: "Reach out",
    back: !1,
    actions: [],
    body: o`<div class="page">
      ${Ka(t)}
      <div class="reach-card">
        <div class="mono accent" style="font-size:10px">CLOSE FRIEND ROTATION · ~6WK CADENCE</div>
        <div class="h-serif" style="font-size:17px;margin-top:6px">${Oe(n.length, "person", "people")} overdue</div>
      </div>
      ${n.length ? o`<div class="label list-label">Overdue</div>
            <div class="list">${n.map((s) => sn(s, !0))}</div>` : h}
      ${i.length ? o`<div class="label list-label">Due soon</div>
            <div class="list">${i.map((s) => sn(s, !1))}</div>` : h}
      ${!n.length && !i.length ? o`<div class="empty">Everyone's been in touch recently.</div>` : h}
    </div>`
  };
}
function Ya(t, e) {
  const n = $(t);
  switch (e.name) {
    case "reminderNewAny": {
      const i = f.newReminderAny();
      return { ...Te(t), overlay: xe(t, { key: "reminder:new:any", path: i, closeTo: f.reachOut(), person: null, locked: !1, interaction: null, existing: null }) };
    }
    case "reminderNew": {
      const i = Nt(t, e.personId, null), s = n.people.find((r) => r.id === e.personId);
      if (!s) return i;
      const a = f.newReminder(s.id);
      return { ...i, overlay: xe(t, { key: `reminder:new:person:${s.id}`, path: a, closeTo: f.person(s.id), person: s, locked: !0, interaction: null, existing: null }) };
    }
    case "interactionReminderNew": {
      const i = zn(t, e.interactionId, null), s = n.interactions.find((l) => l.id === e.interactionId);
      if (!s) return i;
      const a = Ue(s, n.people)[0] ?? null, r = f.newInteractionReminder(s.id);
      return {
        ...i,
        overlay: xe(t, { key: `reminder:new:interaction:${s.id}`, path: r, closeTo: f.interaction(s.id), person: a, locked: !1, interaction: s, existing: null })
      };
    }
    case "reminder": {
      const i = n.reminders.find((l) => l.id === e.id);
      if (!i) return t.isArriving(e.id) ? pe : G("reminder");
      const s = n.people.find((l) => l.id === i.person_id) ?? null, a = i.interaction_id ? n.interactions.find((l) => l.id === i.interaction_id) ?? null : null, r = { key: `edit:reminder:${i.id}`, path: f.reminder(i.id), closeTo: f.reachOut(), person: s, locked: !0, interaction: a, existing: i };
      return i.state === "done" || i.done_at ? { ...Te(t), overlay: Wa(t, r, i) } : { ...Te(t), overlay: xe(t, r) };
    }
  }
}
const W = (t) => `confirm-delete:reminder:${t}`;
function xe(t, e) {
  const n = $(t), { key: i, path: s, existing: a, interaction: r } = e, l = t.drafts.open(i, s, () => ({
    ...a ? Os(a) : In(),
    person: e.person?.id ?? a?.person_id ?? ""
  })), c = e.locked ? e.person : n.people.find((m) => m.id === l.person) ?? null, d = () => {
    t.drafts.drop(i), O(e.closeTo);
  }, u = !!c && oe(l) !== null, p = async () => {
    const m = t.drafts.get(i), g = m && oe(m);
    if (!m || !g || !c) return;
    if (a) {
      const b = t.drafts.base(i);
      await t.updateReminder(a.id, g, (b && oe(b)) ?? void 0) && d();
      return;
    }
    await t.addReminder({ person_id: c.id, interaction_id: r?.id ?? null, ...g }) && d();
  }, v = V(t, i);
  return o`<div class="sheet-backdrop" @click=${(m) => m.target === m.currentTarget && d()}>
      <div class="sheet" role="dialog" aria-label=${a ? "Edit reminder" : "Add reminder"}>
        <div class="topbar">
          <button class="icon-btn" style="padding:0 12px" @click=${d}>Cancel</button>
          <span class="title" style="text-align:center">${a ? "Reminder" : "Add reminder"}</span>
          <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!u || t.busy} @click=${p}>
            Save
          </button>
        </div>
        <div class="sheet-body">
          <div class="form">
            ${e.locked ? o`<div class="field">
                  <span>Person</span>
                  ${c ? o`<div style="display:flex;align-items:center;gap:10px">${C(c.name, c.photo_url, 26)} ${c.name}</div>` : o`<div class="muted">No longer in Hearth</div>`}
                </div>` : me(t, {
    id: "reminder-person",
    label: "Person",
    path: s,
    selected: c ? [c.id] : [],
    onPick: (m) => t.drafts.patch(i, { person: m }),
    onRemove: () => t.drafts.patch(i, { person: "" }),
    disabled: t.busy
  })}
            ${r ? o`<div class="muted" style="font-size:12.5px">From: ${r.summary}</div>` : h}
            ${On(v, n.today, n.reminder_units, t.busy)}
            ${a ? o`<button
                  class="btn danger"
                  style="margin-top:12px"
                  ?disabled=${t.busy}
                  @click=${() => t.drafts.put(W(a.id), s, {})}
                >
                  Delete reminder
                </button>` : h}
          </div>
        </div>
      </div>
    </div>
    ${a && t.drafts.get(W(a.id)) ? ai(t, a, c, d) : h}`;
}
function Wa(t, e, n) {
  const { path: i, person: s, interaction: a } = e, r = () => {
    t.drafts.drop(W(n.id)), O(e.closeTo);
  }, l = $(t).today, c = n.repeat_every && n.repeat_unit ? ` · ${At(n.repeat_every, n.repeat_unit)}` : "";
  return o`<div class="sheet-backdrop" @click=${(d) => d.target === d.currentTarget && r()}>
      <div class="sheet" role="dialog" aria-label="Done reminder">
        <div class="topbar">
          <button class="icon-btn" style="padding:0 12px" @click=${r}>Close</button>
          <span class="title" style="text-align:center">Reminder</span>
          <span style="padding:0 12px"></span>
        </div>
        <div class="sheet-body">
          <div class="form">
            <div class="field">
              <span>Person</span>
              ${s ? o`<div style="display:flex;align-items:center;gap:10px">${C(s.name, s.photo_url, 26)} ${s.name}</div>` : o`<div class="muted">No longer in Hearth</div>`}
            </div>
            ${a ? o`<div class="muted" style="font-size:12.5px">From: ${a.summary}</div>` : h}
            <div class="field"><span>Note</span><div>${n.note ?? o`<span class="muted">No note</span>`}</div></div>
            <div class="field"><span>Due</span><div>${Pn(n, l)}${c}</div></div>
            <div class="field"><span>Status</span><div>Done</div></div>
            <button
              class="btn danger"
              style="margin-top:12px"
              ?disabled=${t.busy}
              @click=${() => t.drafts.put(W(n.id), i, {})}
            >
              Delete reminder
            </button>
          </div>
        </div>
      </div>
    </div>
    ${t.drafts.get(W(n.id)) ? ai(t, n, s, r) : h}`;
}
function ai(t, e, n, i) {
  const s = W(e.id), a = e.note ? `“${e.note}”` : "This reminder";
  return M({
    title: "Delete this reminder?",
    lines: [`${a}${n ? ` for ${n.name}` : ""} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(s),
    onConfirm: async () => {
      await t.deleteReminder(e.id) && (t.drafts.drop(s), i());
    }
  });
}
const Ja = [
  ["people", "People"],
  ["households", "Households"],
  ["groups", "Groups"]
], rn = (t, e) => e === "" || t.toLocaleLowerCase().includes(e.toLocaleLowerCase());
function Xa(t) {
  const e = D(t);
  return o`<a class="row" href=${f.household(t.id)}>
    ${C(e, t.photo_url)}
    <span class="main"><div class="name ${Z(t) ? "" : "muted"}">${e}</div></span>
    <span class="meta">${Oe(t.member_ids.length, "member")}</span>
  </a>`;
}
function Za(t) {
  return o`<a class="row" href=${f.group(t.id)}>
    ${C(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      ${t.description ? o`<div class="sub">${t.description}</div>` : h}
    </span>
    <span class="meta">${Oe(t.member_ids.length, "member")}</span>
  </a>`;
}
function Qa(t) {
  const { people: e, households: n, groups: i, relationships: s } = $(t), a = t.search.text.trim();
  switch (t.search.chip) {
    case "people": {
      const r = Ct(a, e, s);
      return o`${r.direct.map((l) => tt(l))}
      ${r.connected.length ? o`${is("Connected")} ${r.connected.map((l) => tt(l.person, l.reason))}` : h}
      ${r.direct.length + r.connected.length === 0 ? o`<div class="empty">No one matches “${a}”.</div>` : h}`;
    }
    case "households":
      return n.map((r) => ({ h: r, name: D(r) })).filter(({ name: r }) => rn(r, a)).sort((r, l) => L(r.name, l.name)).map(({ h: r }) => Xa(r));
    case "groups":
      return i.filter((r) => rn(r.name, a)).sort((r, l) => L(r.name, l.name)).map(Za);
  }
}
function er(t) {
  if (t === "people") return h;
  const [e, n] = t === "households" ? ["New household", f.newHousehold()] : ["New group", f.newGroup()];
  return o`<div style="padding:0 16px 8px"><a class="btn secondary new-record" style="display:inline-flex;align-items:center" href=${n}>${e}</a></div>`;
}
function tr(t) {
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
        ${Ja.map(
      ([i, s]) => o`<button
            class="pill mono ${n === i ? "on" : ""}"
            aria-pressed=${n === i ? "true" : "false"}
            @click=${() => t.setSearch({ chip: i })}
          >
            ${s}
          </button>`
    )}
      </div>
      ${er(n)}
      <div class="list">${Qa(t)}</div>
    </div>`
  };
}
const nr = new URL(import.meta.url).searchParams.get("v"), ir = [
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
  },
  // No time: each reminder notifies when it comes due.
  { kind: "reminders", id: "notify-reminders", label: "Reminders", help: "A notification when a reminder you set comes due." }
];
function sr(t) {
  const { status: e, loadError: n, testing: i } = t.notifications;
  if (!e)
    return o`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${n ? `Couldn't load the notification settings: ${n}` : "Loading…"}</div>
    </div>`;
  const s = e.devices === 0;
  return o`<div class="card" style="padding:13px;display:grid;gap:14px">
    ${s ? o`<div class="muted" id="notify-no-phone" role="status" style="font-size:12.5px">
          No phone is set up for notifications. Install the Home Assistant Companion app and sign in as yourself.
        </div>` : h}
    ${ir.map(({ kind: a, id: r, label: l, help: c }) => {
    const d = e.settings[a];
    return o`<div style="display:grid;gap:6px">
        <label class="check">
          <input
            id=${r}
            type="checkbox"
            role="switch"
            ?disabled=${t.busy}
            .checked=${k(d.enabled)}
            @change=${(u) => void t.setNotification(a, { enabled: u.target.checked })}
          />
          <span>${l}</span>
        </label>
        <div class="muted" style="font-size:12.5px">${c}</div>
        ${d.time === void 0 ? h : o`<label class="field">
          <span>Time</span>
          <input
            id=${`${r}-time`}
            class="input"
            type="time"
            step="60"
            ?disabled=${t.busy}
            .value=${k(d.time)}
            @change=${(u) => {
      const p = u.target.value;
      p && t.setNotification(a, { time: p });
    }}
          />
        </label>`}
      </div>`;
  })}
    <button class="btn secondary" id="notify-test" ?disabled=${t.busy || i || s} @click=${() => void t.sendTestNotification()}>
      ${i ? "Sending…" : "Send a test"}
    </button>
  </div>`;
}
const ar = 8, ke = "me-picker";
function rr(t) {
  const { people: e, relationships: n, me_person_id: i } = $(t), s = i ? e.find((u) => u.id === i) : void 0, a = t.drafts.get(ke)?.query ?? null, r = () => t.drafts.drop(ke), l = async (u) => {
    await t.setMe(u) && r();
  }, c = o`<div style="display:flex;align-items:center;gap:12px">
    ${s ? o`${C(s.name, s.photo_url, 36)}<span style="flex:1;font-weight:600">${s.name}</span>` : o`<span class="muted" style="flex:1">Not set</span>`}
    ${a === null ? o`<button class="btn secondary" @click=${() => t.drafts.put(ke, f.settings(), { query: "" })}>Change</button>
          ${s ? o`<button class="btn secondary" ?disabled=${t.busy} @click=${() => l(null)}>Clear</button>` : h}` : h}
  </div>`;
  if (a === null) return o`<div class="card" style="padding:13px">${c}</div>`;
  const d = Ct(a.trim(), e, n).direct.slice(0, ar);
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
      @input=${(u) => t.drafts.patch(ke, { query: u.target.value })}
    />
    <div class="list">
      ${d.length ? d.map(
    (u) => o`<button class="row me-choice" style="width:100%;text-align:left" ?disabled=${t.busy} @click=${() => l(u.id)}>
              ${C(u.name, u.photo_url)}<span class="main"><div class="name">${u.name}</div></span>
            </button>`
  ) : o`<div class="empty">No one matches “${a.trim()}”.</div>`}
    </div>
    <button class="btn secondary" @click=${r}>Cancel</button>
  </div>`;
}
function or(t) {
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
const Pe = "confirm-import";
function lr(t, e) {
  return M({
    title: `Import ${e.name}?`,
    lines: ["Everything in your Hearth is replaced by what's in this file."],
    confirmLabel: "Import",
    busy: t.busy,
    onCancel: () => t.drafts.drop(Pe),
    onConfirm: () => {
      t.drafts.drop(Pe), t.importBundle(e, !1);
    }
  });
}
function cr(t) {
  const e = t.importState, n = e.kind === "uploading", i = (s) => {
    const a = s.target, r = a.files?.[0];
    a.value = "", r && t.drafts.put(Pe, f.settings(), { file: r });
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
    ${n ? o`<div class="notice" role="status" style="margin:0">Uploading and importing…</div>` : h}
    ${e.kind === "done" ? o`<div class="notice" role="status" style="margin:0">${e.summary}</div>` : h}
    ${e.kind === "refused" ? o`<div role="alert" style="display:grid;gap:8px">
          <div>${or(e)}</div>
          ${e.reason === "invalid" && e.problems.length ? o`<ul class="muted" style="margin:0;padding-left:18px;font-size:12.5px">
                ${e.problems.map((s) => o`<li>${s}</li>`)}
              </ul>` : h}
          ${e.reason === "local_changes" ? o`<div class="actions" style="display:flex;gap:8px">
                <button class="btn secondary" ?disabled=${t.busy} @click=${() => t.clearImport()}>Cancel</button>
                <button class="btn danger" ?disabled=${t.busy} @click=${() => void t.importBundle(e.file, !0)}>Replace everything</button>
              </div>` : h}
        </div>` : h}
  </div>`;
}
function dr(t) {
  const e = t.drafts.get(Pe);
  return {
    overlay: e ? lr(t, e.file) : Ca(t),
    title: "Settings",
    back: !0,
    actions: [],
    body: o`<div class="page">
      <div class="label" style="padding:16px 20px 8px">This is me</div>
      ${rr(t)}

      <div class="label" style="padding:0 20px 8px">Notifications</div>
      ${sr(t)}

      <div class="label" style="padding:0 20px 8px">Export</div>
      <div class="card" style="padding:13px;display:grid;gap:10px">
        <div class="muted" style="font-size:12.5px">Saves everything in your Hearth as one file in your Hearth exports folder.</div>
        <button class="btn" ?disabled=${t.busy} @click=${() => void t.exportNow()}>Export now</button>
      </div>

      <div class="label" style="padding:0 20px 8px">Import</div>
      ${cr(t)}

      <div class="label" style="padding:0 20px 8px">Google Contacts</div>
      ${ka(t)}

      <div class="label" style="padding:0 20px 8px">About</div>
      <div class="card" style="padding:13px">Version ${nr ?? "unknown"}</div>
    </div>`
  };
}
const hr = "https://claude.ai/new", ur = "Offline. Showing what was last loaded; changes are paused.";
function pr(t, e) {
  switch (e.name) {
    case "home":
      return vs(t);
    case "search":
      return tr(t);
    case "reachOut":
      return Te(t);
    case "add":
      return rs(t);
    case "birthdays":
      return ys(t);
    case "interactions":
      return bs(t);
    case "settings":
      return dr(t);
    case "person":
      return Nt(t, e.id, e.sheet);
    case "personEdit":
      return Ga(t, e.id);
    case "relationship":
      return Ba(t, e.personId, e.relId);
    case "household":
      return la(t, e.id);
    case "householdNew":
      return Qs(t);
    case "householdEdit":
      return oa(t, e.id);
    case "group":
      return ca(t, e.id);
    case "groupNew":
      return Ys(t);
    case "groupEdit":
      return Xs(t, e.id);
    case "interaction":
      return zn(t, e.id, e.sheet);
    case "reminder":
    case "reminderNewAny":
    case "reminderNew":
    case "interactionReminderNew":
      return Ya(t, e);
  }
}
const on = [
  { tab: "home", href: f.home(), icon: w.home, label: "Home" },
  { tab: "search", href: f.search(), icon: w.search, label: "Search" },
  { tab: "reachOut", href: f.reachOut(), icon: w.bell, label: "Reach out" },
  { tab: "add", href: f.add(), icon: w.plusCircle, label: "Add" }
];
function fr(t) {
  const e = (n) => o`<a href=${n.href} class=${t === n.tab ? "active" : ""} aria-label=${n.label} title=${n.label}
      aria-current=${t === n.tab ? "page" : "false"}>${n.icon}</a>`;
  return o`<nav class="tabbar">
    ${on.slice(0, 2).map(e)}
    <a href=${hr} target="_blank" rel="noopener noreferrer" aria-label="Talk to Claude" title="Talk to Claude">${w.mic}</a>
    ${on.slice(2).map(e)}
  </nav>`;
}
function ri() {
  return o`<button class="icon-btn" aria-label="Menu" title="Menu" @click=${(e) => e.currentTarget.dispatchEvent(new Event("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>${w.menu}</button>`;
}
function oi(t) {
  return t ? o`<div class="toast" role="status">${t}</div>` : h;
}
function mr(t, e) {
  const n = e.narrow || t.back || t.title || t.actions.length;
  return o`<div class="shell">
    ${n ? o`<header class="topbar">
          ${e.narrow ? ri() : h}
          ${t.back ? o`<button class="icon-btn" aria-label="Back" title="Back" @click=${() => O(f.home())}>
                ${w.back}
              </button>` : h}
          <span class="title">${t.title ?? ""}</span>
          ${t.actions.map(ns)}
          <button class="icon-btn muted" aria-label="Refresh" title="Refresh" ?disabled=${e.refreshing} @click=${e.onRefresh}>
            ${w.refresh}
          </button>
        </header>` : h}
    <main class="content" id="content">
      ${e.store.offline ? o`<div class="notice" role="status">${ur}</div>` : h} ${t.body}
    </main>
    ${fr(e.lastTab)} ${t.overlay ?? h} ${oi(e.toast)}
  </div>`;
}
function K(t, e) {
  return o`<div class="shell">
    ${e.narrow ? o`<header class="topbar">${ri()}<span class="title">Hearth</span></header>` : h}
    <main class="content status">${t}</main>
    ${oi(e.toast)}
  </div>`;
}
const ln = (t) => t.length > 1 ? t.replace(/\/+$/, "") : t;
function gr(t, e) {
  const n = ln(t), i = ln(e);
  return n === i || n.startsWith(`${i}/`);
}
class vr {
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
    for (const [n, i] of this.entries) gr(e, i.path) || this.entries.delete(n);
  }
}
const yr = {
  person: ["address", "school"],
  household: ["address"]
}, li = (t, e) => yr[t]?.includes(e) ?? !1;
function ci(t, e) {
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
    case "reminder":
      return t.reminders;
  }
}
function We(t, e, n) {
  return ci(t, e).find((i) => i.id === n);
}
function br(t, e) {
  return ["person", "household", "contact_group", "relationship", "interaction", "reminder"].some((i) => ci(t, i).some((s) => s.id === e));
}
const ut = (t, e) => t === e || typeof t == "object" && typeof e == "object" && JSON.stringify(t) === JSON.stringify(e);
function pt(t, e, n) {
  if (typeof n != "string") return n;
  const i = n.trim();
  return li(t, e) ? i ? { formatted: i } : null : i || null;
}
function Je(t, e) {
  return e ? Object.fromEntries(Object.entries(t).filter(([n, i]) => !(n in e) || !ut(i, e[n]))) : t;
}
function Xe(t, e, n) {
  const i = {};
  for (const [s, a] of Object.entries(n)) {
    if (a === void 0) continue;
    const r = e[s] ?? null;
    if (li(t, s) && typeof a == "string") {
      const c = (r?.formatted ?? "").trim();
      a.trim() !== c && (i[s] = pt(t, s, a));
      continue;
    }
    if (ut(a, r)) continue;
    const l = pt(t, s, a);
    ut(l, r) || (i[s] = l);
  }
  return i;
}
function cn(t, e) {
  const n = {};
  for (const [i, s] of Object.entries(e)) {
    const a = pt(t, i, s);
    a != null && (n[i] = a);
  }
  return n;
}
const di = "You're offline. Changes are paused.", Ze = "Still saving…", ft = "That was already deleted.", dn = "hearth_crm:snapshot:";
function hn(t) {
  return t.reminders && t.reminder_units ? t : { ...t, reminders: t.reminders ?? [], reminder_units: t.reminder_units ?? [] };
}
const $r = 250, _r = 3500, un = [2e3, 5e3, 1e4], wr = 1e4;
class xr {
  constructor(e, n, i, s, a) {
    this.api = e, this.conn = n, this.userId = i, this.storage = s, this.onChange = a, this.phase = { kind: "loading" }, this.snapshot = null, this.entryId = null, this.offline = !1, this.lastError = null, this.createError = null, this.creating = !1, this.retrying = !1, this.search = { text: "", chip: "people" }, this.drafts = new vr(() => this.onChange()), this.busy = !1, this.shrinkingPhoto = !1, this.importState = { kind: "idle" }, this.google = { status: null, loadError: null, preview: null, lastSync: null, working: null }, this.notifications = { status: null, loadError: null, testing: !1 }, this.toast = null, this.writeError = null, this.subscription = null, this.connEpoch = 0, this.timer = null, this.retryTimer = null, this.retryAttempt = 0, this.generation = 0, this.stopped = !1, this.startRun = null, this.retryRun = null, this.toastTimer = null, this.fetchSeq = 0, this.arriving = null, this.pendingMembers = /* @__PURE__ */ new Map(), this.arrivingTimer = null, this.pendingFavorites = /* @__PURE__ */ new Map(), this.onSettings = !1, this.onDisconnected = () => {
      this.connEpoch++, this.subscription = null, this.offline = !0, this.onChange();
    }, this.onReady = () => {
      this.connEpoch++, this.retryAttempt = 0, this.load();
    }, this.onVisibilityChange = () => {
      document.visibilityState !== "visible" || this.offline || !this.snapshot || kr(/* @__PURE__ */ new Date()) !== this.snapshot.today && this.refresh();
    };
  }
  get cacheKey() {
    return `${dn}${this.userId}`;
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
        this.createError = U(e);
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
    this.drafts.leaveTo(e), this.writeError = null, this.onSettings = e === `${_}/settings`, this.onSettings && this.phase.kind === "ready" && (this.loadGoogle(), this.loadNotifications()), this.importState.kind === "refused" && e !== `${_}/settings` && (this.importState = { kind: "idle" });
  }
  showToast(e) {
    this.toastTimer && clearTimeout(this.toastTimer), this.toast = e, this.onChange(), this.toastTimer = setTimeout(() => {
      this.toastTimer = null, this.toast = null, this.onChange();
    }, _r);
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
      this.pendingFavorites.delete(e.id), this.patchFavorite(e.id, e.favorite), this.showToast(Ce(i));
    }
  }
  async addInteraction(e) {
    return await this.createInteraction(e) !== null;
  }
  /** Saves a new interaction and resolves to its id (null if it failed), for a reminder linked to it. */
  async createInteraction(e) {
    const { person_ids: n, type: i, date: s, summary: a, notes: r } = e, l = await this.write(() => this.api.create("interaction", { person_ids: n, type: i, date: s, summary: a, notes: r }));
    return l ? l.value.id : null;
  }
  /**
   * Changes the interaction's own fields only, so the people on a shared one are kept. Only the
   * fields that differ from `base` (what the sheet opened with) and from the snapshot are sent, so
   * an imported summary over the edit limit doesn't block changing just the date. One deleted
   * elsewhere counts as done (with the deleted toast), so its sheet closes.
   */
  async updateInteraction(e, n, i) {
    const { type: s, date: a, summary: r, notes: l } = n, c = Je({ type: s, date: a, summary: r, notes: l }, i ? { ...i } : void 0), d = this.snapshot ? We(this.snapshot, "interaction", e) : void 0, u = d ? Xe("interaction", d, c) : c;
    if (!Object.keys(u).length) return !0;
    const p = () => this.api.update("interaction", e, u);
    return await this.write(p, { ifGone: () => {
    } }) !== null;
  }
  deleteInteraction(e) {
    return this.remove("interaction", e);
  }
  /** Saves a new reminder and resolves to its id (null if it failed). See `save` for arriving. */
  async addReminder(e) {
    const n = { ...cn("reminder", { ...e }), due_at: e.due_at ?? null }, i = await this.write(() => this.api.create("reminder", n));
    return i ? (this.markArriving(i.value.id), i.value.id) : null;
  }
  /** Only the fields that differ from `base` and the snapshot are sent. See `updateInteraction`. */
  async updateReminder(e, n, i) {
    const s = Je({ ...n }, i ? { ...i } : void 0), a = this.snapshot ? We(this.snapshot, "reminder", e) : void 0, r = a ? Xe("reminder", a, s) : s;
    if (!Object.keys(r).length) return !0;
    const l = () => this.api.update("reminder", e, r);
    return await this.write(l, { ifGone: () => {
    } }) !== null;
  }
  deleteReminder(e) {
    return this.remove("reminder", e);
  }
  /** Marks it done (a repeating one rolls to its next date on the server), then refreshes. */
  async completeReminder(e) {
    return await this.write(() => this.api.reminderComplete(e), { failure: "Couldn't mark it done", ifGone: () => {
    } }) ? (await this.refresh(), !0) : !1;
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
      const c = await this.write(() => this.api.create(e, cn(e, i)));
      return c ? (this.markArriving(c.value.id), { id: c.value.id }) : null;
    }
    const a = this.snapshot ? We(this.snapshot, e, n) : void 0;
    if (!a)
      return this.refuseOffline() || this.showToast(ft), null;
    const r = Xe(e, a, Je(i, s));
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
    }, wr), this.onChange();
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
      return this.showToast(Ze), !1;
    this.busy = !0, this.importState = { kind: "uploading" }, this.onChange();
    try {
      const i = await this.api.importBundle(e, n);
      return this.importState = { kind: "done", summary: i.summary }, !0;
    } catch (i) {
      const s = i instanceof S ? i : null, a = s?.code ?? "unknown_error";
      return a === "local_changes" || a === "cutover_confirmed" || a === "invalid" || a === "too_large" || a === "bad_request" || a === "no_crm" ? this.importState = { kind: "refused", reason: a, message: s?.message ?? a, problems: s?.problems ?? [], file: e } : (this.importState = { kind: "idle" }, this.showToast(Ce(i, "Couldn't import"))), !1;
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
      n instanceof S && n.code === "offline" ? this.offline = !0 : this.notifications = { ...this.notifications, loadError: U(n) };
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
      n instanceof S && n.code === "offline" ? this.offline = !0 : this.google = { ...this.google, loadError: U(n) };
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
      return this.showToast(Ze), !1;
    this.google = { ...this.google, working: e }, this.onChange();
    const s = this.generation;
    let a = null;
    try {
      a = await n();
    } catch (r) {
      if (s !== this.generation) return !1;
      this.showToast(Ce(r, i));
    }
    return s !== this.generation || (this.google = e === "preview" ? { ...this.google, working: null, preview: a ?? this.google.preview } : { ...this.google, working: null, lastSync: a ?? this.google.lastSync, preview: a ? null : this.google.preview }, this.onChange(), await this.loadGoogle()), a !== null;
  }
  /** Forgets a person's Google link so the next run creates a new contact. */
  async clearGoogleContact(e) {
    return await this.write(() => this.api.googleClearContact(e), { ifGone: () => {
    } }) ? (await this.loadGoogle(), !0) : !1;
  }
  refuseOffline() {
    return this.offline ? (this.showToast(di), !0) : !1;
  }
  /** Runs one write at a time. Resolves to null, with a toast, when refused or failed. */
  async write(e, n = {}) {
    if (this.refuseOffline()) return null;
    if (this.busy)
      return this.showToast(Ze), null;
    this.busy = !0, this.writeError = null, this.onChange();
    try {
      return { value: await e() };
    } catch (i) {
      const s = i instanceof S ? i : null;
      return n.ifGone && s?.code === "not_found" ? (this.showToast(ft), await this.refresh(), { value: n.ifGone() }) : (this.writeError = s, this.showToast(Ce(i, n.failure)), null);
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
      const i = n instanceof S ? n : null;
      if (i?.code === "offline")
        this.offline = !0;
      else if (i?.code === "no_crm" || i?.code === "crm_not_loaded") {
        await this.load();
        return;
      } else {
        this.lastError = i ?? new S("unknown_error", U(n)), this.showToast(`Couldn't refresh: ${this.lastError.message}`);
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
    this.snapshot || (this.snapshot = this.readCache()), this.snapshot ? (this.offline = !0, this.phase = { kind: "ready" }, this.scheduleRetry()) : this.phase = { kind: "error", message: U(e) }, this.onChange();
  }
  keepAndRetry() {
    this.offline = !0, this.phase = { kind: "ready" }, this.scheduleRetry(), this.onChange();
  }
  scheduleRetry() {
    if (this.stopped) return;
    this.clearRetry();
    const e = un[Math.min(this.retryAttempt, un.length - 1)];
    this.retryAttempt++, this.retryTimer = setTimeout(() => {
      this.retryTimer = null, this.load();
    }, e);
  }
  clearRetry() {
    this.retryTimer && clearTimeout(this.retryTimer), this.retryTimer = null;
  }
  /** `seq` is the fetch's number from fetchSeq, taken when the request started. */
  accept(e, n) {
    const i = hn(e), s = this.arriving;
    s && (n > s.afterSeq || br(i, s.id)) && this.stopArriving();
    const a = this.pendingFavorites.size ? {
      ...i,
      people: i.people.map(
        (r) => this.pendingFavorites.has(r.id) ? { ...r, favorite: this.pendingFavorites.get(r.id) } : r
      )
    } : i;
    this.settlePendingMembers(i, n), this.snapshot = this.withPendingMembers(a), this.offline = !1, this.lastError = null;
    try {
      this.storage?.setItem(this.cacheKey, JSON.stringify(i));
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
        s?.startsWith(dn) && s !== this.cacheKey && n.push(s);
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
      return Array.isArray(n?.people) ? hn(n) : null;
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
    }, $r));
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
function kr(t) {
  const e = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${e(t.getMonth() + 1)}-${e(t.getDate())}`;
}
function Ce(t, e = "Couldn't save") {
  switch (t instanceof S ? t.code : null) {
    case "offline":
      return di;
    case "backup_in_progress":
      return "Home Assistant is making a backup. Try again in a moment.";
    case "invalid":
      return U(t);
    case "not_found":
      return ft;
    case "import_failed":
    case "cutover_not_confirmed":
    case "sync_refused":
    case "sync_failed":
    case "not_blocked":
    case "no_phone":
      return U(t);
    default:
      return `${e}: ${U(t)}`;
  }
}
function U(t) {
  return t instanceof Error ? t.message : String(t);
}
const Cr = ':host{--bg: var(--primary-background-color, #fafafa);--surface: var(--card-background-color, var(--ha-card-background, #ffffff));--text: var(--primary-text-color, #212121);--text-2: var(--secondary-text-color, #727272);--border: var(--divider-color, rgba(0, 0, 0, .12));--accent: var(--primary-color, #03a9f4);--on-accent: var(--text-primary-color, #ffffff);--accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);--hover: color-mix(in srgb, var(--text) 6%, transparent);--thread: var(--divider-color, rgba(0, 0, 0, .12));--danger: var(--error-color, #db4437);--warning: var(--warning-color, #ffa600);--scrim: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, .32));--sans: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif));--serif: var(--sans);--mono: var(--ha-font-family-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace);--tabbar: 56px;position:relative;display:flex;flex-direction:column;height:100dvh;box-sizing:border-box;padding:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) var(--safe-area-content-inset-right, var(--safe-area-inset-right, env(safe-area-inset-right, 0px))) 0 var(--safe-area-content-inset-left, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));background:var(--bg);color:var(--text);font:14px/1.4 var(--sans);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}*{box-sizing:border-box}button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}a{color:inherit;text-decoration:none}input,textarea{font:inherit;color:var(--text)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.shell{display:flex;flex-direction:column;flex:1;min-height:0}.topbar{display:flex;align-items:center;gap:4px;min-height:48px;padding:0 8px;border-bottom:1px solid var(--border);background:var(--bg);flex:none}.topbar .title{flex:1;font:600 16px var(--serif);padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.icon-btn{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border-radius:10px;color:var(--text)}.icon-btn:hover{background:var(--hover)}.icon-btn.accent{color:var(--accent)}.icon-btn.muted{color:var(--text-2)}.icon-btn[disabled]{opacity:.4;cursor:default}.icon-btn svg{width:20px;height:20px}.content{flex:1;overflow-y:auto;overscroll-behavior:contain;padding-bottom:24px;position:relative}.content.status{padding-bottom:calc(24px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.page{max-width:640px;margin:0 auto}.tabbar{flex:none;display:flex;height:calc(var(--tabbar) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));padding-bottom:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));border-top:1px solid var(--border);background:var(--bg)}.tabbar a,.tabbar button{flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-2)}.tabbar .active{color:var(--accent)}.tabbar svg{width:22px;height:22px}.h-serif{font-family:var(--serif);font-weight:600}.mono{font-family:var(--mono)}.label{font:500 10.5px var(--mono);color:var(--text-2);letter-spacing:.02em;text-transform:uppercase}.muted{color:var(--text-2)}.accent{color:var(--accent)}.danger{color:var(--danger)}.warning{color:var(--warning)}.section{margin:16px 0 0}.section-head{display:flex;align-items:baseline;justify-content:space-between;padding:0 16px 6px}.section-head h2{margin:0;font:600 17px var(--serif)}.section-head a,.section-head button{font:600 12px var(--sans);color:var(--accent)}.list{background:var(--surface)}.row{display:flex;align-items:center;gap:12px;padding:8px 16px;min-height:56px;border-bottom:1px solid var(--border);width:100%;text-align:left}.row:last-child{border-bottom:0}.row:hover{background:var(--hover)}.row .main{flex:1;min-width:0}.row .name{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .sub{font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .meta{font:500 10.5px var(--mono);color:var(--text-2);flex:none}.row .star{color:var(--accent);display:inline-block;width:10px;height:10px;margin-left:6px;vertical-align:1px}svg{display:block;width:100%;height:100%}.list-label{padding:10px 16px 4px}.empty{padding:24px 16px;color:var(--text-2);text-align:center}.avatar{flex:none;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-family:var(--serif);font-weight:600;position:relative}.avatar img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}.avatar img.broken{display:none}.stack{display:inline-flex;flex:none}.stack .avatar{box-shadow:0 0 0 2px var(--surface)}.card{background:var(--surface);border-radius:14px;margin:0 16px 18px;padding:10px 13px}.reach-card{margin:16px;padding:16px;border-radius:16px;background:var(--surface);border:1px solid var(--border)}.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--thread);border-radius:999px;font-size:10.5px;color:var(--accent)}.chips{display:flex;flex-wrap:wrap;gap:6px}.pills{display:flex;gap:7px;overflow-x:auto;padding:4px 0}.pill{flex:none;min-height:36px;padding:6px 14px;border-radius:999px;background:var(--surface);color:var(--text-2);font:500 11.5px var(--sans)}.pill.on{background:var(--accent);color:var(--on-accent)}.pill.mono{font:500 11px var(--mono)}.pill.mono.on{background:var(--text);color:var(--bg)}.form{padding:8px 16px;display:grid;gap:16px}.field{display:grid;gap:6px}.field>span{font:500 10.5px var(--mono);color:var(--text-2);text-transform:uppercase}.input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 12px;font-size:15px}.input:focus{border-color:var(--accent);outline:none}textarea.input{min-height:110px;resize:vertical}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px;accent-color:var(--accent)}.btn{min-height:44px;padding:0 18px;border-radius:12px;background:var(--accent);color:var(--on-accent);font-weight:600}.btn[disabled]{opacity:.4;cursor:default}.btn.danger{background:var(--danger);color:var(--on-accent)}.btn.secondary{background:var(--surface);color:var(--text);border:1px solid var(--thread)}.highlight .input{border-color:var(--warning);box-shadow:0 0 0 1px var(--warning)}.field-error{color:var(--danger);font-size:12px}.input[aria-invalid=true]{border-color:var(--danger)}select.input{appearance:auto}.chip-remove{margin-left:2px;min-width:24px;min-height:24px;color:var(--text-2);font-size:14px}.person-picker .chip{color:var(--text)}.photo-picker{display:grid;justify-items:center;gap:10px;padding:8px 0}.photo-picker .actions{display:flex;gap:8px}.file-btn{display:inline-flex;align-items:center;cursor:pointer;position:relative}.file-btn[aria-disabled=true]{opacity:.4;cursor:default}.file-btn:focus-within{outline:2px solid var(--accent);outline-offset:2px}.photo-tap{border-radius:50%}.file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.banner{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--danger);color:var(--on-accent);font:500 11px var(--mono)}.notice{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--accent-soft);color:var(--text);font:500 11px var(--mono)}.center{min-height:60vh;display:grid;place-items:center;text-align:center;padding:24px}.spinner{width:22px;height:22px;border:2px solid var(--thread);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px}@keyframes spin{to{transform:rotate(360deg)}}.sheet-backdrop{position:absolute;inset:0;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10}.sheet{background:var(--bg);width:100%;max-width:640px;max-height:100%;border-radius:16px;display:flex;flex-direction:column;overflow:hidden}.sheet .sheet-body{overflow-y:auto;padding-bottom:calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.dialog{background:var(--surface);border-radius:16px;padding:20px;margin:auto 16px;max-width:360px;width:100%;display:grid;gap:14px;text-align:center}.dialog .actions{display:flex;gap:8px;justify-content:center}.toast{position:absolute;left:50%;transform:translate(-50%);bottom:calc(var(--tabbar) + 16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));background:var(--surface);color:var(--text);border:1px solid var(--border);padding:10px 16px;border-radius:12px;z-index:20;font-size:13px;box-shadow:0 2px 8px var(--scrim)}.actions-row{display:flex;gap:8px;padding:0 20px 18px}.action{width:54px;height:38px;border-radius:12px;background:var(--surface);color:var(--text);display:inline-flex;align-items:center;justify-content:center}.action svg{width:17px;height:17px}.action.primary{background:var(--accent);color:var(--on-accent)}';
function pn() {
  return o`<div class="center"><div class="spinner" role="progressbar" aria-label="Loading"></div></div>`;
}
function Ar(t) {
  return o`<div class="center">
    <div style="max-width:420px">
      <div class="h-serif" style="font-size:21px;margin-bottom:12px">Start your Hearth</div>
      <p class="muted">Your Hearth is private to you: other people on this Home Assistant get their own.</p>
      <button class="btn" ?disabled=${t.creating} aria-busy=${t.creating ? "true" : "false"} @click=${() => void t.createCrm()}>
        ${t.creating ? "Creating…" : "Create my Hearth"}
      </button>
      ${t.createError ? o`<p class="danger" role="alert">${t.createError}</p>` : h}
    </div>
  </div>`;
}
function Er(t) {
  return o`<div class="center">
    <div style="max-width:420px">
      <p>Your Hearth didn't load. Check Settings → Devices &amp; services → Hearth.</p>
      ${hi(t)}
    </div>
  </div>`;
}
function hi(t) {
  return o`<button class="btn" ?disabled=${t.retrying} aria-busy=${t.retrying ? "true" : "false"} @click=${() => void t.retry()}>
    ${t.retrying ? "Retrying…" : "Retry"}
  </button>`;
}
function Sr(t, e) {
  return o`<div class="center">
    <div style="max-width:420px">
      <p>${e}</p>
      ${hi(t)}
    </div>
  </div>`;
}
function Tr(t) {
  const e = t instanceof Error ? `${t.name}: ${t.message}` : String(t);
  return o`<div class="center">
    <div style="max-width:460px">
      <div class="h-serif" style="font-size:19px;margin-bottom:12px">Hearth hit a problem</div>
      <pre class="mono danger" style="white-space:pre-wrap;font-size:11px;text-align:left">${e}</pre>
      <button class="btn" @click=${() => location.reload()}>Reload</button>
    </div>
  </div>`;
}
var Rr = Object.defineProperty, ge = (t, e, n, i) => {
  for (var s = void 0, a = t.length - 1, r; a >= 0; a--)
    (r = t[a]) && (s = r(e, n, s) || s);
  return s && Rr(e, n, s), s;
};
function Nr(t, e) {
  return t?.user?.id !== e?.user?.id || t?.connection !== e?.connection;
}
function Mr(t, e) {
  return t?.path !== e?.path || t?.prefix !== e?.prefix;
}
function Pr() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
class te extends ae {
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
      !i || !Bi(i) || (e.preventDefault(), i !== `${location.pathname}${location.search}` && z(i));
    };
  }
  static {
    this.styles = mn(Cr);
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
    return Gi(this.route?.path ?? "");
  }
  willUpdate(e) {
    if (this.syncStore(), e.has("route")) {
      const n = e.get("route"), i = this.renderRoot.querySelector("#content");
      n && i && this.scrollPositions.set(n.path, i.scrollTop), this.lastTab = ji(this.currentRoute) ?? this.lastTab, this.store?.routeChanged(`${_}${this.route?.path ?? ""}`);
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
    const n = new xr(
      new zi(this.hass.connection, () => this.hass?.auth),
      this.hass.connection,
      e,
      Pr(),
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
    if (!e) return K(pn(), n);
    try {
      const i = e.phase;
      switch (i.kind) {
        case "loading":
          return K(pn(), n);
        case "noCrm":
          return K(Ar(e), n);
        case "notLoaded":
          return K(Er(e), n);
        case "error":
          return K(Sr(e, i.message), n);
        case "ready": {
          const s = { ...n, store: e, lastTab: this.lastTab, refreshing: this.refreshing, onRefresh: this.onRefresh };
          return mr(pr(e, this.currentRoute), s);
        }
      }
    } catch (i) {
      return console.error(i), K(Tr(i), n);
    }
  }
}
ge([
  ue({ attribute: !1, hasChanged: Nr })
], te.prototype, "hass");
ge([
  ue({ type: Boolean })
], te.prototype, "narrow");
ge([
  ue({ attribute: !1, hasChanged: Mr })
], te.prototype, "route");
ge([
  ue({ attribute: !1 })
], te.prototype, "panel");
ge([
  Hi()
], te.prototype, "refreshing");
customElements.get("hearth-panel") || customElements.define("hearth-panel", te);
export {
  te as HearthPanel,
  nr as PANEL_VERSION,
  Nr as hassChanged
};
