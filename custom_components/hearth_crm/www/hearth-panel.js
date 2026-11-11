/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const xe = globalThis, ft = xe.ShadowRoot && (xe.ShadyCSS === void 0 || xe.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, un = Symbol(), Nt = /* @__PURE__ */ new WeakMap();
let hi = class {
  constructor(e, n, i) {
    if (this._$cssResult$ = !0, i !== un) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = n;
  }
  get styleSheet() {
    let e = this.o;
    const n = this.t;
    if (ft && e === void 0) {
      const i = n !== void 0 && n.length === 1;
      i && (e = Nt.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), i && Nt.set(n, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const pn = (t) => new hi(typeof t == "string" ? t : t + "", void 0, un), ui = (t, e) => {
  if (ft) t.adoptedStyleSheets = e.map((n) => n instanceof CSSStyleSheet ? n : n.styleSheet);
  else for (const n of e) {
    const i = document.createElement("style"), s = xe.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = n.cssText, t.appendChild(i);
  }
}, Pt = ft ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((e) => {
  let n = "";
  for (const i of e.cssRules) n += i.cssText;
  return pn(n);
})(t) : t;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: pi, defineProperty: fi, getOwnPropertyDescriptor: mi, getOwnPropertyNames: gi, getOwnPropertySymbols: vi, getPrototypeOf: yi } = Object, Re = globalThis, It = Re.trustedTypes, bi = It ? It.emptyScript : "", $i = Re.reactiveElementPolyfillSupport, ie = (t, e) => t, Ee = { toAttribute(t, e) {
  switch (e) {
    case Boolean:
      t = t ? bi : null;
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
} }, mt = (t, e) => !pi(t, e), Ht = { attribute: !0, type: String, converter: Ee, reflect: !1, useDefault: !1, hasChanged: mt };
Symbol.metadata ??= Symbol("metadata"), Re.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
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
      s !== void 0 && fi(this.prototype, e, s);
    }
  }
  static getPropertyDescriptor(e, n, i) {
    const { get: s, set: r } = mi(this.prototype, e) ?? { get() {
      return this[n];
    }, set(a) {
      this[n] = a;
    } };
    return { get: s, set(a) {
      const o = s?.call(this);
      r?.call(this, a), this.requestUpdate(e, o, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Ht;
  }
  static _$Ei() {
    if (this.hasOwnProperty(ie("elementProperties"))) return;
    const e = yi(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(ie("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(ie("properties"))) {
      const n = this.properties, i = [...gi(n), ...vi(n)];
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
      for (const s of i) n.unshift(Pt(s));
    } else e !== void 0 && n.push(Pt(e));
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
    return ui(e, this.constructor.elementStyles), e;
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
      const r = (i.converter?.toAttribute !== void 0 ? i.converter : Ee).toAttribute(n, i.type);
      this._$Em = e, r == null ? this.removeAttribute(s) : this.setAttribute(s, r), this._$Em = null;
    }
  }
  _$AK(e, n) {
    const i = this.constructor, s = i._$Eh.get(e);
    if (s !== void 0 && this._$Em !== s) {
      const r = i.getPropertyOptions(s), a = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : Ee;
      this._$Em = s;
      const o = a.fromAttribute(n, r.type);
      this[s] = o ?? this._$Ej?.get(s) ?? o, this._$Em = null;
    }
  }
  requestUpdate(e, n, i, s = !1, r) {
    if (e !== void 0) {
      const a = this.constructor;
      if (s === !1 && (r = this[e]), i ??= a.getPropertyOptions(e), !((i.hasChanged ?? mt)(r, n) || i.useDefault && i.reflect && r === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, i)))) return;
      this.C(e, n, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, n, { useDefault: i, reflect: s, wrapped: r }, a) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? n ?? this[e]), r !== !0 || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || i || (n = void 0), this._$AL.set(e, n)), s === !0 && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
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
        for (const [s, r] of this._$Ep) this[s] = r;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, r] of i) {
        const { wrapped: a } = r, o = this[s];
        a !== !0 || this._$AL.has(s) || o === void 0 || this.C(s, void 0, r, o);
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
Y.elementStyles = [], Y.shadowRootOptions = { mode: "open" }, Y[ie("elementProperties")] = /* @__PURE__ */ new Map(), Y[ie("finalized")] = /* @__PURE__ */ new Map(), $i?.({ ReactiveElement: Y }), (Re.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const gt = globalThis, Ot = (t) => t, Se = gt.trustedTypes, Dt = Se ? Se.createPolicy("lit-html", { createHTML: (t) => t }) : void 0, fn = "$lit$", O = `lit$${Math.random().toFixed(9).slice(2)}$`, mn = "?" + O, _i = `<${mn}>`, j = document, oe = () => j.createComment(""), le = (t) => t === null || typeof t != "object" && typeof t != "function", vt = Array.isArray, wi = (t) => vt(t) || typeof t?.[Symbol.iterator] == "function", Ge = `[ 	
\f\r]`, te = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Lt = /-->/g, Ut = />/g, F = RegExp(`>|${Ge}(?:([^\\s"'>=/]+)(${Ge}*=${Ge}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), zt = /'/g, Gt = /"/g, gn = /^(?:script|style|textarea|title)$/i, vn = (t) => (e, ...n) => ({ _$litType$: t, strings: e, values: n }), l = vn(1), x = vn(2), I = Symbol.for("lit-noChange"), h = Symbol.for("lit-nothing"), Ft = /* @__PURE__ */ new WeakMap(), B = j.createTreeWalker(j, 129);
function yn(t, e) {
  if (!vt(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Dt !== void 0 ? Dt.createHTML(e) : e;
}
const xi = (t, e) => {
  const n = t.length - 1, i = [];
  let s, r = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", a = te;
  for (let o = 0; o < n; o++) {
    const c = t[o];
    let d, u, p = -1, y = 0;
    for (; y < c.length && (a.lastIndex = y, u = a.exec(c), u !== null); ) y = a.lastIndex, a === te ? u[1] === "!--" ? a = Lt : u[1] !== void 0 ? a = Ut : u[2] !== void 0 ? (gn.test(u[2]) && (s = RegExp("</" + u[2], "g")), a = F) : u[3] !== void 0 && (a = F) : a === F ? u[0] === ">" ? (a = s ?? te, p = -1) : u[1] === void 0 ? p = -2 : (p = a.lastIndex - u[2].length, d = u[1], a = u[3] === void 0 ? F : u[3] === '"' ? Gt : zt) : a === Gt || a === zt ? a = F : a === Lt || a === Ut ? a = te : (a = F, s = void 0);
    const m = a === F && t[o + 1].startsWith("/>") ? " " : "";
    r += a === te ? c + _i : p >= 0 ? (i.push(d), c.slice(0, p) + fn + c.slice(p) + O + m) : c + O + (p === -2 ? o : m);
  }
  return [yn(t, r + (t[n] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), i];
};
class ce {
  constructor({ strings: e, _$litType$: n }, i) {
    let s;
    this.parts = [];
    let r = 0, a = 0;
    const o = e.length - 1, c = this.parts, [d, u] = xi(e, n);
    if (this.el = ce.createElement(d, i), B.currentNode = this.el.content, n === 2 || n === 3) {
      const p = this.el.content.firstChild;
      p.replaceWith(...p.childNodes);
    }
    for (; (s = B.nextNode()) !== null && c.length < o; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const p of s.getAttributeNames()) if (p.endsWith(fn)) {
          const y = u[a++], m = s.getAttribute(p).split(O), g = /([.?@])?(.*)/.exec(y);
          c.push({ type: 1, index: r, name: g[2], strings: m, ctor: g[1] === "." ? Ci : g[1] === "?" ? Ei : g[1] === "@" ? Si : Me }), s.removeAttribute(p);
        } else p.startsWith(O) && (c.push({ type: 6, index: r }), s.removeAttribute(p));
        if (gn.test(s.tagName)) {
          const p = s.textContent.split(O), y = p.length - 1;
          if (y > 0) {
            s.textContent = Se ? Se.emptyScript : "";
            for (let m = 0; m < y; m++) s.append(p[m], oe()), B.nextNode(), c.push({ type: 2, index: ++r });
            s.append(p[y], oe());
          }
        }
      } else if (s.nodeType === 8) if (s.data === mn) c.push({ type: 2, index: r });
      else {
        let p = -1;
        for (; (p = s.data.indexOf(O, p + 1)) !== -1; ) c.push({ type: 7, index: r }), p += O.length - 1;
      }
      r++;
    }
  }
  static createElement(e, n) {
    const i = j.createElement("template");
    return i.innerHTML = e, i;
  }
}
function W(t, e, n = t, i) {
  if (e === I) return e;
  let s = i !== void 0 ? n._$Co?.[i] : n._$Cl;
  const r = le(e) ? void 0 : e._$litDirective$;
  return s?.constructor !== r && (s?._$AO?.(!1), r === void 0 ? s = void 0 : (s = new r(t), s._$AT(t, n, i)), i !== void 0 ? (n._$Co ??= [])[i] = s : n._$Cl = s), s !== void 0 && (e = W(t, s._$AS(t, e.values), s, i)), e;
}
class ki {
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
    let r = B.nextNode(), a = 0, o = 0, c = i[0];
    for (; c !== void 0; ) {
      if (a === c.index) {
        let d;
        c.type === 2 ? d = new de(r, r.nextSibling, this, e) : c.type === 1 ? d = new c.ctor(r, c.name, c.strings, this, e) : c.type === 6 && (d = new Ai(r, this, e)), this._$AV.push(d), c = i[++o];
      }
      a !== c?.index && (r = B.nextNode(), a++);
    }
    return B.currentNode = j, s;
  }
  p(e) {
    let n = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(e, i, n), n += i.strings.length - 2) : i._$AI(e[n])), n++;
  }
}
class de {
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
    e = W(this, e, n), le(e) ? e === h || e == null || e === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : e !== this._$AH && e !== I && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : wi(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== h && le(this._$AH) ? this._$AA.nextSibling.data = e : this.T(j.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: n, _$litType$: i } = e, s = typeof i == "number" ? this._$AC(e) : (i.el === void 0 && (i.el = ce.createElement(yn(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(n);
    else {
      const r = new ki(s, this), a = r.u(this.options);
      r.p(n), this.T(a), this._$AH = r;
    }
  }
  _$AC(e) {
    let n = Ft.get(e.strings);
    return n === void 0 && Ft.set(e.strings, n = new ce(e)), n;
  }
  k(e) {
    vt(this._$AH) || (this._$AH = [], this._$AR());
    const n = this._$AH;
    let i, s = 0;
    for (const r of e) s === n.length ? n.push(i = new de(this.O(oe()), this.O(oe()), this, this.options)) : i = n[s], i._$AI(r), s++;
    s < n.length && (this._$AR(i && i._$AB.nextSibling, s), n.length = s);
  }
  _$AR(e = this._$AA.nextSibling, n) {
    for (this._$AP?.(!1, !0, n); e !== this._$AB; ) {
      const i = Ot(e).nextSibling;
      Ot(e).remove(), e = i;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class Me {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, n, i, s, r) {
    this.type = 1, this._$AH = h, this._$AN = void 0, this.element = e, this.name = n, this._$AM = s, this.options = r, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = h;
  }
  _$AI(e, n = this, i, s) {
    const r = this.strings;
    let a = !1;
    if (r === void 0) e = W(this, e, n, 0), a = !le(e) || e !== this._$AH && e !== I, a && (this._$AH = e);
    else {
      const o = e;
      let c, d;
      for (e = r[0], c = 0; c < r.length - 1; c++) d = W(this, o[i + c], n, c), d === I && (d = this._$AH[c]), a ||= !le(d) || d !== this._$AH[c], d === h ? e = h : e !== h && (e += (d ?? "") + r[c + 1]), this._$AH[c] = d;
    }
    a && !s && this.j(e);
  }
  j(e) {
    e === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class Ci extends Me {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === h ? void 0 : e;
  }
}
class Ei extends Me {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== h);
  }
}
class Si extends Me {
  constructor(e, n, i, s, r) {
    super(e, n, i, s, r), this.type = 5;
  }
  _$AI(e, n = this) {
    if ((e = W(this, e, n, 0) ?? h) === I) return;
    const i = this._$AH, s = e === h && i !== h || e.capture !== i.capture || e.once !== i.once || e.passive !== i.passive, r = e !== h && (i === h || s);
    s && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class Ai {
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
const Ti = gt.litHtmlPolyfillSupport;
Ti?.(ce, de), (gt.litHtmlVersions ??= []).push("3.3.3");
const Ri = (t, e, n) => {
  const i = n?.renderBefore ?? e;
  let s = i._$litPart$;
  if (s === void 0) {
    const r = n?.renderBefore ?? null;
    i._$litPart$ = s = new de(e.insertBefore(oe(), r), r, void 0, n ?? {});
  }
  return s._$AI(t), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const yt = globalThis;
let se = class extends Y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const e = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= e.firstChild, e;
  }
  update(e) {
    const n = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ri(n, this.renderRoot, this.renderOptions);
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
se._$litElement$ = !0, se.finalized = !0, yt.litElementHydrateSupport?.({ LitElement: se });
const Mi = yt.litElementPolyfillSupport;
Mi?.({ LitElement: se });
(yt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ni = { attribute: !0, type: String, converter: Ee, reflect: !1, hasChanged: mt }, Pi = (t = Ni, e, n) => {
  const { kind: i, metadata: s } = n;
  let r = globalThis.litPropertyMetadata.get(s);
  if (r === void 0 && globalThis.litPropertyMetadata.set(s, r = /* @__PURE__ */ new Map()), i === "setter" && ((t = Object.create(t)).wrapped = !0), r.set(n.name, t), i === "accessor") {
    const { name: a } = n;
    return { set(o) {
      const c = e.get.call(this);
      e.set.call(this, o), this.requestUpdate(a, c, t, !0, o);
    }, init(o) {
      return o !== void 0 && this.C(a, void 0, t, o), o;
    } };
  }
  if (i === "setter") {
    const { name: a } = n;
    return function(o) {
      const c = this[a];
      e.call(this, o), this.requestUpdate(a, c, t, !0, o);
    };
  }
  throw Error("Unsupported decorator location: " + i);
};
function he(t) {
  return (e, n) => typeof n == "object" ? Pi(t, e, n) : ((i, s, r) => {
    const a = s.hasOwnProperty(r);
    return s.constructor.createProperty(r, i), a ? Object.getOwnPropertyDescriptor(s, r) : void 0;
  })(t, e, n);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function Ii(t) {
  return he({ ...t, state: !0, attribute: !1 });
}
function Hi(t) {
  return t && typeof t == "object" ? t : null;
}
class A extends Error {
  constructor(e, n, i, s = []) {
    super(n), this.code = e, this.field = i, this.problems = s, this.name = "HearthError";
  }
}
const Oi = /^([A-Za-z_][\w.]*): /;
function Bt(t) {
  if (t instanceof A) return t;
  const e = t ?? {}, n = typeof e.message == "string" ? e.message : String(t);
  if (typeof e.code == "string" && e.code) {
    const i = e.code === "invalid" ? Oi.exec(n)?.[1] : void 0;
    return new A(e.code, n, i);
  }
  return typeof e.code == "number" ? new A("offline", n) : t instanceof Error ? new A("unknown_error", n) : new A("offline", n);
}
class Di {
  /** `auth` is read when an upload starts, because Home Assistant swaps it when the token refreshes. */
  constructor(e, n = () => {
  }) {
    this.conn = e, this.auth = n;
  }
  async send(e) {
    try {
      return await this.conn.sendMessagePromise(e);
    } catch (n) {
      throw Bt(n);
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
      return await this.conn.subscribeMessage((n) => e(Hi(n)), { type: "hearth_crm/subscribe" }, { resubscribe: !1 });
    } catch (n) {
      throw Bt(n);
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
    if (!i) throw new A("unknown_error", "Not signed in to Home Assistant.");
    const s = new FormData();
    s.append("file", e, e.name), s.append("replace_existing", n ? "true" : "false");
    let r;
    try {
      i.expired && await i.refreshAccessToken(), r = await fetch("/api/hearth_crm/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${i.data.access_token}` },
        body: s
      });
    } catch (o) {
      throw new A("offline", o instanceof Error ? o.message : String(o));
    }
    if (r.ok) return await r.json();
    let a = null;
    try {
      a = await r.json();
    } catch {
    }
    if (typeof a?.reason == "string") {
      const o = Array.isArray(a.problems) ? a.problems.filter((c) => typeof c == "string") : [];
      throw new A(a.reason, typeof a.message == "string" ? a.message : a.reason, void 0, o);
    }
    throw new A("import_failed", "Import failed unexpectedly; see the Home Assistant log.");
  }
}
const _ = "/hearth";
function Li(t) {
  const e = t.split("/").filter(Boolean).map(Ui), [n, i, s] = e;
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
        const r = e[3];
        if (r) return { name: "relationship", personId: i, relId: r === "new" ? null : r };
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
      if (i) return { name: "reminder", id: i };
      break;
    case "interaction":
      if (i && s === "reminder" && e[3] === "new") return { name: "interactionReminderNew", interactionId: i };
      if (i) return { name: "interaction", id: i, sheet: s === "edit" ? "edit" : null };
      break;
  }
  return { name: "home" };
}
function Ui(t) {
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
  newReminder: (t) => `${_}/person/${R(t)}/reminder/new`,
  newInteractionReminder: (t) => `${_}/interaction/${R(t)}/reminder/new`
};
function zi(t) {
  return t === _ || t.startsWith(`${_}/`) || t.startsWith(`${_}?`);
}
function Gi(t) {
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
const Xe = "hearthDepth";
function Ze() {
  const t = history.state?.[Xe];
  return typeof t == "number" ? t : 0;
}
function U(t, e = !1) {
  e ? history.replaceState({ [Xe]: Ze() }, "", t) : history.pushState({ [Xe]: Ze() + 1 }, "", t), window.dispatchEvent(new Event("location-changed"));
}
function z(t) {
  Ze() > 0 ? history.back() : U(t, !0);
}
/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const jt = (t) => t ?? h;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const q = { ATTRIBUTE: 1, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4 }, bn = (t) => (...e) => ({ _$litDirective$: t, values: e });
let $n = class {
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
const Fi = (t) => t.strings === void 0, Bi = {}, _n = (t, e = Bi) => t._$AH = e;
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ji = bn(class extends $n {
  constructor() {
    super(...arguments), this.key = h;
  }
  render(t, e) {
    return this.key = t, e;
  }
  update(t, [e, n]) {
    return e !== this.key && (_n(t), this.key = e), n;
  }
});
function bt(t) {
  return /* @__PURE__ */ new Date(`${t}T00:00:00Z`);
}
const Vi = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), qi = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), Ki = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }), Ae = (t) => Vi.format(bt(t)), Yi = (t) => qi.format(bt(t)), wn = (t) => Ki.format(bt(t));
function Wi(t, e, n) {
  if (e) return Ae(t);
  const i = `${Ae(t)}, ${t.slice(0, 4)}`;
  return n === null ? i : `${i} - ${n}`;
}
function Ji(t) {
  return t === 0 ? "Today" : `In ${t} ${t === 1 ? "day" : "days"}`;
}
function Xi(t) {
  return t.trim().split(/\s+/).slice(0, 2).map((e) => e.charAt(0)).join("").toUpperCase();
}
function Ne(t, e, n = `${e}s`) {
  return `${t} ${t === 1 ? e : n}`;
}
const E = (t) => x`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`, me = (t) => x`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${t}</svg>`, w = {
  home: E(x`<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>`),
  search: E(x`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`),
  mic: me(x`<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/>`),
  bell: E(x`<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`),
  plusCircle: E(x`<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>`),
  plus: E(x`<path d="M12 5v14M5 12h14"/>`),
  star: E(x`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  starFill: me(x`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  phone: E(x`<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>`),
  message: E(x`<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.6A8.5 8.5 0 1 1 21 12z"/>`),
  envelope: E(x`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`),
  mapPin: E(x`<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`),
  globe: E(x`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>`),
  linkedIn: me(x`<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/>`),
  facebook: me(x`<path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2C16.7 2.1 15.7 2 14.6 2 12.2 2 10.6 3.4 10.6 6.1v2.4H8v3.3h2.6V22H14V11.8h2.6l.4-3.3z"/>`),
  instagram: E(x`<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>`),
  pencil: E(x`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`),
  trash: E(x`<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>`),
  back: E(x`<path d="m15 18-6-6 6-6"/>`),
  refresh: E(x`<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>`),
  gear: E(x`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`),
  menu: E(x`<path d="M4 6h16M4 12h16M4 18h16"/>`),
  close: E(x`<path d="M6 6l12 12M18 6 6 18"/>`)
};
function S(t, e, n = 42) {
  const i = Math.round(n * 15 / 42);
  return l`<span class="avatar" style="width:${n}px;height:${n}px;font-size:${i}px">
    ${Xi(t)}
    ${e ? ji(
    e,
    l`<img src=${e} alt="" loading="lazy" @error=${(s) => s.target.classList.add("broken")} />`
  ) : h}
  </span>`;
}
function Zi(t, e = 42, n = 3) {
  const i = t.slice(0, n), s = t.length - i.length, r = Math.round(e / 3);
  return l`<span class="stack" aria-hidden="true">
    ${i.map(
    (a, o) => l`<span style="margin-left:${o === 0 ? 0 : -r}px;z-index:${i.length - o};display:inline-flex"
          >${S(a.name, a.photo_url, e)}</span
        >`
  )}
    ${s > 0 ? l`<span style="margin-left:${-r}px;z-index:${i.length + 1};display:inline-flex"
          ><span class="avatar" style="width:${e}px;height:${e}px;font-size:${Math.round(e * 15 / 42)}px;box-shadow:0 0 0 2px var(--surface)"
            >+${s}</span
          ></span
        >` : h}
  </span>`;
}
function Qe(t, e) {
  const n = t.contact_status, i = e ?? t.how_i_know_them?.trim() ?? "", s = n.days_since_contact === null ? "—" : `${n.days_since_contact}d ago`;
  return l`<a class="row" href=${f.person(t.id)}>
    ${S(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}${t.favorite ? l`<span class="star">${w.starFill}</span>` : h}</div>
      ${i ? l`<div class="sub">${i}</div>` : h}
    </span>
    <span class="meta ${n.urgency === "overdue" ? "danger" : ""}">${s}</span>
  </a>`;
}
function Qi(t) {
  return t.href ? l`<a
      class="icon-btn ${t.className ?? ""}"
      href=${t.href}
      target=${jt(t.external ? "_blank" : void 0)}
      rel=${jt(t.external ? "noopener noreferrer" : void 0)}
      aria-label=${t.label}
      title=${t.label}
      >${t.icon}</a
    >` : l`<button
    class="icon-btn ${t.className ?? ""}"
    @click=${t.onClick}
    ?disabled=${t.disabled ?? !1}
    aria-label=${t.label}
    title=${t.label}
  >
    ${t.icon}
  </button>`;
}
const es = (t) => l`<div class="label list-label">${t}</div>`;
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const k = bn(class extends $n {
  constructor(t) {
    if (super(t), t.type !== q.PROPERTY && t.type !== q.ATTRIBUTE && t.type !== q.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
    if (!Fi(t)) throw Error("`live` bindings can only contain a single expression");
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
    return _n(t), e;
  }
}), ts = () => ({
  name: "",
  phone: "",
  email: "",
  how_i_know_them: "",
  has_birthday: !1,
  birthday: "",
  birth_year_unknown: !1
}), ns = { name: 200, phone: 50, email: 500, how_i_know_them: 2e3 }, Fe = (t) => t.trim() || null, Vt = "add-person";
function is(t) {
  const e = t.drafts.open(Vt, f.add(), ts), n = (a) => t.drafts.patch(Vt, a), i = e.name.trim() !== "" && (!e.has_birthday || e.birthday !== ""), s = (a, o, c = "text", d = "off") => l`<label class="field">
      <span>${o}</span>
      <input
        id=${`add-${a.replace(/_/g, "-")}`}
        class="input"
        type=${c}
        autocomplete=${d}
        maxlength=${ns[a]}
        .value=${k(e[a])}
        @input=${(u) => n({ [a]: u.target.value })}
      />
    </label>`, r = async () => {
    if (!i) return;
    const a = await t.addPerson({
      name: e.name,
      phone: Fe(e.phone),
      email: Fe(e.email),
      how_i_know_them: Fe(e.how_i_know_them),
      birthday: e.has_birthday ? e.birthday : null,
      birth_year_unknown: e.has_birthday && e.birth_year_unknown
    });
    a && U(f.person(a));
  };
  return {
    title: "Add person",
    back: !1,
    actions: [],
    body: l`<div class="page form">
      ${s("name", "Name")} ${s("phone", "Phone", "tel", "tel")} ${s("email", "Email", "email", "email")}
      ${s("how_i_know_them", "How I know them")}
      <label class="check">
        <input type="checkbox" .checked=${k(e.has_birthday)} @change=${(a) => n({ has_birthday: a.target.checked })} />
        Has a known birthday
      </label>
      ${e.has_birthday ? l`<label class="field">
              <span>Birthday</span>
              <input id="add-birthday" class="input" type="date" .value=${k(e.birthday)}
                @input=${(a) => n({ birthday: a.target.value })} />
            </label>
            <label class="check">
              <input
                type="checkbox"
                .checked=${k(e.birth_year_unknown)}
                @change=${(a) => n({ birth_year_unknown: a.target.checked })}
              />
              Year unknown
            </label>` : h}
      <button class="btn" ?disabled=${!i || t.busy} @click=${r}>Save</button>
    </div>`
  };
}
const ss = new Intl.Collator("en", { numeric: !0, sensitivity: "base" });
function L(t, e) {
  return ss.compare(t, e);
}
function et(t, e) {
  return L(t.name, e.name);
}
function Pe(t) {
  return t.trim().split(/\s+/)[0] ?? "";
}
function X(t) {
  return t.name_status !== "needs_name" && t.name_status !== "not_a_household" && !!t.name;
}
function H(t) {
  return X(t) ? t.name : t.name_status === "not_a_household" ? "Not a household" : "Needs a name";
}
function $t(t, e) {
  const n = H(t);
  if (X(t)) return n;
  const i = t.member_ids.map((s) => e.find((r) => r.id === s)).filter((s) => !!s).map((s) => Pe(s.name)).filter(Boolean);
  return i.length ? `${n} (${i.join(", ")})` : n;
}
function xn(t, e) {
  return t.filter(
    (n) => n.days_until_birthday !== null && (e === void 0 || n.days_until_birthday <= e)
  ).sort((n, i) => n.days_until_birthday - i.days_until_birthday || L(n.name, i.name));
}
const rs = /^(\d{4})-(\d{2})-(\d{2})$/, as = 864e5;
function os(t) {
  const e = rs.exec(t);
  if (!e) throw new Error(`Not a calendar day: ${t}`);
  return Date.UTC(Number(e[1]), Number(e[2]) - 1, Number(e[3]));
}
function ls(t, e) {
  return new Date(os(t) + e * as).toISOString().slice(0, 10);
}
const cs = 6;
function ds(t) {
  return t.filter((e) => e.favorite).slice(0, cs);
}
function kn(t, e, n) {
  const i = new Set(e.map((r) => r.id)), { since: s } = n;
  return t.filter((r) => (s === void 0 || r.date >= s) && r.person_ids.some((a) => i.has(a))).sort(Cn).slice(0, n.limit);
}
function hs(t, e) {
  return t.filter((n) => n.person_ids.includes(e)).sort(Cn);
}
function Cn(t, e) {
  return t.date === e.date ? 0 : t.date > e.date ? -1 : 1;
}
function Ie(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const i of e) n.has(i.id) || n.set(i.id, i);
  return t.person_ids.flatMap((i) => {
    const s = n.get(i);
    return s ? [s] : [];
  });
}
function us(t) {
  const e = (s) => Pe(s.name) || s.name, [n, i] = t;
  return n ? i ? t.length === 2 ? `${e(n)} & ${e(i)}` : `${e(n)} and ${t.length - 1} others` : n.name : "";
}
function $(t) {
  if (!t.snapshot) throw new Error("No snapshot to draw from");
  return t.snapshot;
}
function G(t) {
  return { title: null, back: !0, actions: [], body: l`<div class="empty">This ${t} no longer exists.</div>` };
}
const ue = {
  title: null,
  back: !0,
  actions: [],
  body: l`<div class="center"><div><div class="spinner"></div></div></div>`
};
function En(t, e) {
  const n = e.length === 1 ? e[0] : void 0, i = l`${Zi(e)}<span class="name" style="flex:1;min-width:0"
      >${us(e)}</span
    >`;
  return l`<div class="row" style="flex-direction:column;align-items:stretch;gap:2px">
    <a
      href=${n ? f.person(n.id) : f.interaction(t.id)}
      style="display:flex;align-items:center;gap:12px"
      >${i}</a
    >
    <a href=${f.interaction(t.id)} style="display:flex;gap:12px">
      <span class="sub" style="flex:1">${t.summary}</span>
      <span class="meta">${Ae(t.date)}</span>
    </a>
  </div>`;
}
function ps(t) {
  return l`<a class="row" href=${f.person(t.id)}>
    ${S(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${Ji(t.days_until_birthday ?? 0)}</div>
    </span>
  </a>`;
}
function fs(t) {
  const { people: e, interactions: n, today: i } = $(t), s = ds(e), r = xn(e, 30).slice(0, 3), a = kn(n, e, { since: ls(i, -30), limit: 10 });
  return {
    title: "Hearth",
    back: !1,
    actions: [{ icon: w.gear, label: "Settings", href: f.settings() }],
    body: l`<div class="page">
      ${s.length ? l`<div class="list favorites" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 12px;padding:16px">
            ${s.map(
      (o) => l`<a href=${f.person(o.id)} style="display:grid;justify-items:center;gap:6px;min-width:0">
                ${S(o.name, o.photo_url, 56)}
                <span class="fav-name" style="font-weight:600;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >${Pe(o.name)}</span
                >
              </a>`
    )}
          </div>` : h}

      <div class="section">
        <div class="section-head"><h2>Upcoming</h2><a href=${f.birthdays()}>See all</a></div>
        <div class="list">
          ${r.length ? r.map(ps) : l`<div class="empty">No birthdays in the next 30 days.</div>`}
        </div>
      </div>

      <div class="section">
        <!-- "See more", not "See all": that list caps at 25. -->
        <div class="section-head"><h2>Recent</h2><a href=${f.interactions()}>See more</a></div>
        <div class="list">
          ${a.length ? a.map((o) => En(o, Ie(o, e))) : l`<div class="empty">Nothing logged in the last 30 days.</div>`}
        </div>
      </div>
    </div>`
  };
}
function ms(t) {
  const e = xn($(t).people);
  return {
    title: "Birthdays",
    back: !0,
    actions: [],
    body: l`<div class="page list">
      ${e.length ? e.map((n) => {
      const i = n.days_until_birthday ?? 0;
      return l`<a class="row" href=${f.person(n.id)}>
              ${S(n.name, n.photo_url)}
              <span class="main"><div class="name">${n.name}</div></span>
              <span class="meta">${i === 0 ? "Today" : `${i}d`}</span>
            </a>`;
    }) : l`<div class="empty">No birthdays yet.</div>`}
    </div>`
  };
}
function gs(t) {
  const { people: e, interactions: n } = $(t), i = kn(n, e, { limit: 25 });
  return {
    title: "Recent",
    back: !0,
    actions: [],
    body: l`<div class="page list">
      ${i.length ? i.map((s) => En(s, Ie(s, e))) : l`<div class="empty">No interactions yet.</div>`}
    </div>`
  };
}
function N(t) {
  return l`<div class="sheet-backdrop" style="align-items:center">
    <div class="dialog" role="alertdialog" aria-label=${t.title}>
      <div class="h-serif" style="font-size:17px">${t.title}</div>
      ${t.lines.map((e) => l`<div class="muted" style="font-size:12.5px">${e}</div>`)}
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
    error: (n) => Sn(t.writeError, n)
  };
}
function Sn(t, e) {
  const n = t?.field;
  if (!t || !n || n !== e && !n.startsWith(`${e}.`)) return null;
  const i = `${n}: `;
  return t.message.startsWith(i) ? t.message.slice(i.length) : t.message;
}
const Z = (t) => `field-${t.replace(/_/g, "-")}`, pe = (t, e) => {
  const n = t.get(e);
  return typeof n == "string" ? n : "";
}, _t = (t) => t.target.value;
function Q(t, e) {
  const n = t.error(e);
  return n ? l`<div class="field-error" role="alert" data-error-for=${e}>${n}</div>` : h;
}
function M(t, e, n, i = {}) {
  return l`<label class="field">
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
      .value=${k(pe(t, e))}
      @input=${(s) => t.set(e, _t(s))}
    />
    ${Q(t, e)}
  </label>`;
}
function J(t, e, n, i) {
  return l`<label class="field">
    <span>${n}</span>
    <textarea
      id=${Z(e)}
      name=${e}
      class="input"
      maxlength=${i}
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(pe(t, e))}
      @input=${(s) => t.set(e, s.target.value)}
    ></textarea>
    ${Q(t, e)}
  </label>`;
}
function ge(t, e, n) {
  return l`<label class="field">
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
      .value=${k(pe(t, e))}
      @input=${(i) => t.set(e, _t(i))}
    />
    ${Q(t, e)}
  </label>`;
}
function tt(t, e, n) {
  return M(t, e, n, { maxlength: 1e3 });
}
function vs(t, e, n, i) {
  const s = pe(t, e);
  return l`<label class="field">
      <span>${n}</span>
      <input
        id=${Z(e)}
        name=${e}
        class="input"
        type="date"
        aria-invalid=${t.error(e) ? "true" : "false"}
        .value=${k(s)}
        @input=${(r) => {
    const a = _t(r);
    t.set(e, a), a || t.set(i, !1);
  }}
      />
      ${Q(t, e)}
    </label>
    ${s ? nt(t, i, "Year unknown") : h}`;
}
function nt(t, e, n) {
  return l`<label class="check">
      <input
        id=${Z(e)}
        name=${e}
        type="checkbox"
        .checked=${k(t.get(e) === !0)}
        @change=${(i) => t.set(e, i.target.checked)}
      />
      ${n}
    </label>
    ${Q(t, e)}`;
}
function wt(t, e, n, i) {
  const s = pe(t, e);
  return l`<label class="field">
    <span>${n}</span>
    <select
      id=${Z(e)}
      name=${e}
      class="input"
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${k(s)}
      @change=${(r) => t.set(e, r.target.value)}
    >
      ${i.map((r) => l`<option value=${r.value} ?selected=${r.value === s}>${r.label}</option>`)}
    </select>
    ${Q(t, e)}
  </label>`;
}
const ys = "08:00", bs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function He(t) {
  const [e, n, i] = t.split("-").map(Number);
  return [e, n, i];
}
function An(t, e, n) {
  return `${String(t).padStart(4, "0")}-${String(e).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
function qt(t, e) {
  const [n, i, s] = He(t), r = new Date(Date.UTC(n, i - 1, s + e));
  return An(r.getUTCFullYear(), r.getUTCMonth() + 1, r.getUTCDate());
}
function Be(t, e) {
  const [n, i, s] = He(t), r = n * 12 + (i - 1) + e, a = Math.floor(r / 12), o = r % 12 + 1, c = new Date(Date.UTC(a, o, 0)).getUTCDate();
  return An(a, o, Math.min(s, c));
}
function $s(t, e) {
  let n;
  switch (t) {
    case "someday":
      return null;
    case "tomorrow":
      n = qt(e, 1);
      break;
    case "next_week": {
      const [i, s, r] = He(e), a = new Date(Date.UTC(i, s - 1, r)).getUTCDay();
      n = qt(e, (8 - a) % 7 || 7);
      break;
    }
    case "month":
      n = Be(e, 1);
      break;
    case "quarter":
      n = Be(e, 3);
      break;
    case "year":
      n = Be(e, 12);
      break;
  }
  return `${n}T${ys}`;
}
function Tn(t, e) {
  return t === 1 ? `Every ${e}` : `Every ${t} ${e}s`;
}
function Kt(t) {
  const [, e, n] = He(t);
  return `${bs[e - 1]} ${n}`;
}
function _s(t) {
  const [e, n] = t.split(":").map(Number);
  return `${e % 12 || 12}:${String(n).padStart(2, "0")} ${e < 12 ? "AM" : "PM"}`;
}
function ws(t, e) {
  return t.due_date ? t.state === "overdue" ? `Overdue · ${Kt(t.due_date)}` : t.state === "due_today" || t.due_date === e ? t.due_time ? `Today ${_s(t.due_time)}` : "Today" : Kt(t.due_date) : "Someday";
}
const xt = "08:00", xs = 2e4, it = 999, ks = [
  { pick: "tomorrow", label: "Tomorrow" },
  { pick: "next_week", label: "Next week" },
  { pick: "month", label: "In a month" },
  { pick: "quarter", label: "In 3 months" },
  { pick: "year", label: "In a year" },
  { pick: "someday", label: "Someday" },
  { pick: "custom", label: "Custom" }
], Cs = { day: "Days", week: "Weeks", month: "Months", year: "Years" };
function Rn() {
  return { note: "", pick: null, date: "", time: xt, repeat_every: "1", repeat_unit: "" };
}
function Es(t) {
  return {
    note: t.note ?? "",
    pick: t.due_date ? "custom" : "someday",
    date: t.due_date ?? "",
    time: t.due_time ?? xt,
    repeat_every: String(t.repeat_every ?? 1),
    repeat_unit: t.repeat_unit ?? ""
  };
}
function Mn(t) {
  const e = Number(t);
  return Number.isInteger(e) && e >= 1 && e <= it ? e : null;
}
function re(t) {
  if (!t.pick) return null;
  const e = t.note.trim() || null;
  if (t.pick === "someday") return { note: e, due_at: null, repeat_every: null, repeat_unit: null };
  if (!t.date || !t.time) return null;
  const n = `${t.date}T${t.time}`;
  if (!t.repeat_unit) return { note: e, due_at: n, repeat_every: null, repeat_unit: null };
  const i = Mn(t.repeat_every);
  return i === null ? null : { note: e, due_at: n, repeat_every: i, repeat_unit: t.repeat_unit };
}
function Ss(t, e) {
  return {
    get: (n) => (t.get(e) ?? {})[n],
    set: (n, i) => t.set(e, { ...t.get(e) ?? {}, [n]: i }),
    error: (n) => t.error(n)
  };
}
function Nn(t, e, n, i = !1) {
  const s = t.get("pick"), r = (p) => {
    if (t.set("pick", p), p === "custom") return;
    const y = $s(p, e);
    t.set("date", y ? y.slice(0, 10) : ""), t.set("time", y ? y.slice(11) : xt), t.set("repeat_unit", "");
  }, a = String(t.get("repeat_unit") ?? ""), o = String(t.get("repeat_every") ?? ""), c = Mn(o), d = (p) => String(t.get(p) ?? ""), u = (p) => (y) => t.set(p, y.target.value);
  return l`${J(t, "note", "Note", xs)}
    <div class="field">
      <span>Remind me</span>
      <div class="pills" style="flex-wrap:wrap">
        ${ks.map(
    (p) => l`<button
            class="pill ${s === p.pick ? "on" : ""}"
            aria-pressed=${s === p.pick ? "true" : "false"}
            ?disabled=${i}
            @click=${() => r(p.pick)}
          >
            ${p.label}
          </button>`
  )}
      </div>
    </div>
    ${s === "custom" ? l`<label class="field">
            <span>Date</span>
            <input id="field-date" name="date" class="input" type="date" .value=${k(d("date"))} @input=${u("date")} />
          </label>
          <label class="field">
            <span>Time</span>
            <input id="field-time" name="time" class="input" type="time" .value=${k(d("time"))} @input=${u("time")} />
          </label>
          ${wt(t, "repeat_unit", "Repeat", [
    { value: "", label: "Doesn't repeat" },
    ...n.map((p) => ({ value: p, label: Cs[p] ?? p }))
  ])}
          ${a ? l`<label class="field">
                <span>Every</span>
                <input id="field-repeat-every" name="repeat_every" class="input" type="number" inputmode="numeric" min="1" max=${it}
                  aria-invalid=${c === null ? "true" : "false"} .value=${k(o)} @input=${u("repeat_every")} />
                <div class="muted" style="font-size:12px">${c === null ? `A number from 1 to ${it}` : Tn(c, a)}</div>
              </label>` : h}` : h}`;
}
const As = "https://claude.ai/new";
function Ts(t, e, n, i) {
  return t.drafts.open(e, n, () => {
    const { interaction_types: s, today: r } = $(t);
    return {
      type: i?.type ?? s[0] ?? "",
      date: i?.date ?? r,
      summary: i?.summary ?? "",
      notes: i?.notes ?? "",
      reminder: null
    };
  });
}
const Yt = (t) => ({
  type: t.type,
  date: t.date,
  summary: t.summary.trim(),
  notes: t.notes.trim() || null
});
function Pn(t, e, n) {
  const i = n ? `edit:${n.id}` : `log:${e.id}`, s = Ts(t, i, n ? f.editInteraction(n.id) : f.logInteraction(e.id), n), r = $(t).interaction_types, a = () => {
    t.drafts.drop(i), z(n ? f.interaction(n.id) : f.person(e.id));
  }, o = (m) => t.drafts.patch(i, m), c = s.summary.trim() !== "" && s.date !== "" && s.type !== "" && (!s.reminder || re(s.reminder) !== null), d = (m) => Sn(t.writeError, m), u = (m) => {
    const g = d(m);
    return g ? l`<div class="field-error" role="alert" data-error-for=${m}>${g}</div>` : h;
  }, p = async () => {
    if (!c) return;
    const m = Yt(s), g = t.drafts.base(i);
    if (n) {
      await t.updateInteraction(n.id, m, g && Yt(g)) && a();
      return;
    }
    const C = await t.createInteraction({ person_ids: [e.id], ...m });
    if (C === null) return;
    const b = s.reminder && re(s.reminder);
    b && await t.addReminder({ person_id: e.id, interaction_id: C, ...b }), a();
  }, y = $(t);
  return l`<div class="sheet-backdrop" @click=${(m) => m.target === m.currentTarget && a()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit interaction" : "Log interaction"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${a}>Cancel</button>
        <span class="title" style="text-align:center">${n ? "Edit" : "Log"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!c || t.busy} @click=${p}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          <div class="field">
            <span>Person</span>
            <div style="display:flex;align-items:center;gap:10px">${S(e.name, e.photo_url, 26)} ${e.name}</div>
          </div>
          <div class="field">
            <span>Type</span>
            <div class="pills">
              ${r.map(
    (m) => l`<button
                  class="pill ${s.type === m ? "on" : ""}"
                  aria-pressed=${s.type === m ? "true" : "false"}
                  @click=${() => o({ type: m })}
                >
                  ${m}
                </button>`
  )}
            </div>
          </div>
          <label class="field">
            <span>Date</span>
            <input id="log-date" class="input" type="date" required .value=${k(s.date)}
              @input=${(m) => o({ date: m.target.value })} />
          </label>
          <label class="field">
            <span>Summary</span>
            <input id="log-summary" class="input" maxlength="300" aria-invalid=${d("summary") ? "true" : "false"}
              .value=${k(s.summary)} @input=${(m) => o({ summary: m.target.value })} />
            ${u("summary")}
          </label>
          <label class="field">
            <span>Notes</span>
            <textarea id="log-notes" class="input" maxlength="20000" aria-invalid=${d("notes") ? "true" : "false"}
              .value=${k(s.notes)} @input=${(m) => o({ notes: m.target.value })}></textarea>
            ${u("notes")}
          </label>
          ${Ms(t, i, s, n, y.today, y.reminder_units)}
          <a href=${As} target="_blank" rel="noopener noreferrer" style="display:grid;justify-items:center;gap:8px;padding:8px 0">
            <span class="action primary" style="width:44px;height:44px;border-radius:50%">${w.mic}</span>
            <span class="muted" style="font-size:11.5px">Or tell Claude about it, and it logs it in Hearth for you.</span>
          </a>
        </div>
      </div>
    </div>
  </div>`;
}
const Rs = "display:flex;align-items:center;justify-content:center";
function Ms(t, e, n, i, s, r) {
  if (i)
    return l`<a class="btn secondary" style=${Rs} href=${f.newInteractionReminder(i.id)}>Add reminder</a>`;
  const a = (o) => t.drafts.patch(e, { reminder: o });
  return n.reminder ? l`<div class="label">Reminder</div>
    ${Nn(Ss(V(t, e), "reminder"), s, r, t.busy)}
    <button class="btn secondary" @click=${() => a(null)}>Remove reminder</button>` : l`<button class="btn secondary" @click=${() => a(Rn())}>Add reminder</button>`;
}
function Ns(t, e, n) {
  const i = e.state !== "done", s = i ? ws(e, n) : "Done", r = e.repeat_every && e.repeat_unit ? ` · ${Tn(e.repeat_every, e.repeat_unit)}` : "";
  return l`<div class="row reminder-row">
    <a class="main" href=${f.reminder(e.id)}>
      <div class="name">${e.note || "Reminder"}</div>
      <div class="sub" style=${e.state === "overdue" ? "color:var(--danger)" : ""}>${s}${r}</div>
    </a>
    ${i ? l`<button class="pill" ?disabled=${t.busy} @click=${() => void t.completeReminder(e.id)}>Done</button>` : h}
  </div>`;
}
function In(t, e, n, i) {
  if (!e.length) return h;
  const { today: s } = $(t);
  return l`<div class="label" style=${n}>Reminders</div>
    <div class="card" style=${i}>${e.map((r) => Ns(t, r, s))}</div>`;
}
function Ps(t, e, n) {
  return [
    n ? { icon: w.pencil, label: "Edit", href: f.editInteraction(e.id) } : { icon: w.pencil, label: "Edit", disabled: !0 },
    {
      icon: w.trash,
      label: "Delete interaction",
      onClick: () => t.drafts.put(kt(e.id), f.interaction(e.id), {})
    }
  ];
}
const kt = (t) => `confirm-delete:interaction:${t}`;
function Is(t, e, n) {
  const i = kt(e.id);
  return N({
    title: "Delete this interaction?",
    lines: [`“${e.summary}” on ${wn(e.date)} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(i),
    onConfirm: async () => {
      await t.deleteInteraction(e.id) && (t.drafts.drop(i), z(n ? f.person(n.id) : f.home()));
    }
  });
}
function Hn(t, e, n) {
  const { interactions: i, people: s, reminders: r } = $(t), a = i.find((d) => d.id === e);
  if (!a) return G("interaction");
  const o = Ie(a, s), c = o[0];
  return {
    title: null,
    back: !0,
    actions: Ps(t, a, c),
    body: l`<div class="page" style="padding:20px;display:grid;gap:18px">
      ${o.length ? l`<div style="display:grid;gap:12px">
            ${o.length > 1 ? l`<div class="label">People</div>` : h}
            ${o.map(
      (d) => l`<a href=${f.person(d.id)} style="display:flex;align-items:center;gap:12px">
                ${S(d.name, d.photo_url)}<span class="accent" style="font-weight:600;font-size:15px">${d.name}</span>
              </a>`
    )}
          </div>` : h}
      <div>
        <div class="label">${wn(a.date)}</div>
        <div class="mono accent" style="font-size:10.5px">${a.type}</div>
      </div>
      <div class="h-serif" style="font-size:19px">${a.summary}</div>
      ${a.notes ? l`<div><div class="label" style="margin-bottom:6px">Notes</div><div style="white-space:pre-wrap">${a.notes}</div></div>` : h}
      <div>
        ${In(t, r.filter((d) => d.interaction_id === a.id), "margin-bottom:6px", "margin:0;padding:0")}
        <a class="accent" href=${f.newInteractionReminder(a.id)} style="display:block;font-size:12.5px;padding:8px 0">Add reminder</a>
      </div>
    </div>`,
    overlay: l`${n === "edit" && c ? Pn(t, c, a) : h}${t.drafts.get(kt(e)) ? Is(t, a, c) : h}`
  };
}
function Wt(t) {
  return t.birthday && !t.birth_year_unknown ? t.birthday : null;
}
function On(t, e) {
  const n = Wt(t), i = Wt(e);
  return n && i && n !== i ? n < i ? -1 : 1 : n && !i ? -1 : !n && i ? 1 : L(t.name, e.name);
}
const Dn = [
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
], Hs = new Map(Dn.map((t, e) => [t, e]));
function Jt(t) {
  return (t === null ? void 0 : Hs.get(t)) ?? Dn.length;
}
function Os(t) {
  return [...t].sort((e, n) => {
    const i = Jt(e.connectionType) - Jt(n.connectionType);
    return i !== 0 ? i : On(e.person, n.person);
  });
}
const ae = { parent: 0, unplaced: 1, child: 2 };
function Ds(t, e) {
  const n = new Set(t), i = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), r = (o, c) => {
    c === "Parent" ? i.add(o) : c === "Child" && s.add(o);
  };
  for (const o of e)
    !n.has(o.person_a_id) || !n.has(o.person_b_id) || (r(o.person_b_id, o.type), r(o.person_a_id, o.inverse_type));
  const a = /* @__PURE__ */ new Map();
  for (const o of t)
    i.has(o) ? a.set(o, ae.parent) : s.has(o) ? a.set(o, ae.child) : a.set(o, ae.unplaced);
  return a;
}
function Ct(t, e, n, i) {
  const s = Ds(e, n);
  return [...t].sort((r, a) => {
    const o = i(r), c = i(a), d = s.get(o.id) ?? ae.unplaced, u = s.get(c.id) ?? ae.unplaced;
    return d !== u ? d - u : On(o, c);
  });
}
function Oe(t, e) {
  return t.person_a_id === t.person_b_id ? null : t.person_a_id === e ? { otherId: t.person_b_id, type: t.type } : t.person_b_id === e ? { otherId: t.person_a_id, type: t.inverse_type } : null;
}
function Ls(t) {
  return t.householdMembers.length === 0 && t.others.length === 0 && t.groups.length === 0;
}
function Us(t, e) {
  const { people: n, households: i, groups: s, relationships: r, excludedId: a } = e, o = /* @__PURE__ */ new Map();
  for (const b of n) o.has(b.id) || o.set(b.id, b);
  const c = /* @__PURE__ */ new Map(), d = [];
  for (const b of r) {
    const v = Oe(b, t);
    !v || v.otherId === a || c.has(v.otherId) || (c.set(v.otherId, { type: v.type, relationshipId: b.id }), d.push(v.otherId));
  }
  const u = (b) => {
    const v = o.get(b), T = c.get(b);
    return v ? { person: v, connectionType: T?.type ?? null, relationshipId: T?.relationshipId ?? null } : null;
  }, p = /* @__PURE__ */ new Set([t]), y = i.find((b) => b.member_ids.includes(t)) ?? null, m = [];
  for (const b of y?.member_ids ?? []) {
    if (b === a || p.has(b)) continue;
    p.add(b);
    const v = u(b);
    v && m.push(v);
  }
  const g = Ct(m, y?.member_ids ?? [], r, (b) => b.person), C = Os(
    d.filter((b) => !p.has(b)).map(u).filter((b) => b !== null)
  );
  return {
    // Dropped when nobody is left to list under it, so the view never draws a household
    // heading over an empty group.
    household: g.length === 0 ? null : y,
    householdMembers: g,
    others: C,
    groups: s.filter((b) => b.member_ids.includes(t)).sort((b, v) => L(b.name, v.name))
  };
}
function Et(t, e, n) {
  const i = [...e].sort(et);
  if (t === "") return { direct: i, connected: [] };
  const s = t.toLocaleLowerCase(), r = i.filter((u) => u.name.toLocaleLowerCase().includes(s)), a = new Map(r.map((u) => [u.id, u])), o = /* @__PURE__ */ new Map();
  for (const u of i) o.has(u.id) || o.set(u.id, u);
  const c = [], d = new Set(a.keys());
  for (const u of n) {
    const p = [u.person_a_id, u.person_b_id].find((C) => a.has(C));
    if (p === void 0) continue;
    const y = Oe(u, p);
    if (!y || d.has(y.otherId)) continue;
    d.add(y.otherId);
    const m = o.get(y.otherId), g = a.get(p);
    !m || !g || c.push({ person: m, reason: `${y.type} of ${g.name}` });
  }
  return { direct: r, connected: c.sort((u, p) => et(u.person, p.person)) };
}
const zs = 8, Gs = 200;
function De(t, e) {
  const { people: n, relationships: i } = $(t), s = `picker:${e.id}`, r = t.drafts.open(s, e.path, () => ({ query: "" })).query, a = e.selected ?? [], o = /* @__PURE__ */ new Set([...e.exclude ?? [], ...a]), c = a.map((g) => n.find((C) => C.id === g)).filter((g) => !!g), d = r.trim(), u = [];
  if (d) {
    const g = Et(d, n, i);
    for (const C of g.direct) u.push({ person: C });
    for (const C of g.connected) u.push(C);
  }
  const p = u.filter((g) => !o.has(g.person.id)).slice(0, zs), y = (g) => {
    t.drafts.patch(s, { query: "" }), e.onPick(g);
  }, m = () => {
    t.drafts.patch(s, { query: "" }), e.onCreate?.(d);
  };
  return l`<div class="field person-picker">
    <label for=${e.id}><span>${e.label}</span></label>
    ${c.length ? l`<div class="chips">
          ${c.map(
    (g) => l`<span class="chip">
              ${S(g.name, g.photo_url, 18)} ${g.name}
              ${e.onRemove ? l`<button
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
      .value=${k(r)}
      @input=${(g) => t.drafts.patch(s, { query: g.target.value })}
    />
    ${d ? l`<div class="list">
          ${p.length ? p.map(
    ({ person: g, reason: C }) => l`<button
                  class="row picker-choice"
                  ?disabled=${e.disabled ?? !1}
                  @click=${() => y(g.id)}
                >
                  ${S(g.name, g.photo_url)}
                  <span class="main">
                    <div class="name">${g.name}</div>
                    ${C ? l`<div class="sub">${C}</div>` : h}
                  </span>
                </button>`
  ) : l`<div class="empty">No one matches “${d}”.</div>`}
          ${e.onCreate ? l`<button
                class="row picker-create"
                ?disabled=${(e.disabled ?? !1) || d.length > Gs}
                @click=${m}
              >
                <span class="main"><div class="name accent">Create “${d}”</div></span>
              </button>` : h}
        </div>` : h}
  </div>`;
}
const Ln = "That file isn't a photo Hearth can use.", Fs = 4e6;
class ne extends Error {
  constructor(e = Ln) {
    super(e), this.name = "PhotoUnusable";
  }
}
const Un = {
  decode: (t) => createImageBitmap(t, { imageOrientation: "from-image" }),
  async encode(t, e, n, i) {
    const s = t;
    if (typeof OffscreenCanvas < "u") {
      const a = new OffscreenCanvas(e, n);
      return Xt(a.getContext("2d"), s, e, n), a.convertToBlob({ type: "image/jpeg", quality: i });
    }
    const r = document.createElement("canvas");
    return r.width = e, r.height = n, Xt(r.getContext("2d"), s, e, n), new Promise(
      (a, o) => r.toBlob((c) => c ? a(c) : o(new Error("encoding failed")), "image/jpeg", i)
    );
  }
};
function Xt(t, e, n, i) {
  if (!t) throw new Error("no 2d canvas");
  t.fillStyle = "white", t.fillRect(0, 0, n, i), t.drawImage(e, 0, 0, n, i);
}
function Bs(t) {
  let e = "";
  for (let i = 0; i < t.length; i += 32768) e += String.fromCharCode(...t.subarray(i, i + 32768));
  return btoa(e);
}
async function js(t, e = 1024, n = 0.85, i = Un) {
  let s;
  try {
    s = await i.decode(t);
  } catch {
    throw new ne();
  }
  try {
    const { width: r, height: a } = s;
    if (!(r > 0 && a > 0)) throw new ne();
    const o = Math.min(1, e / Math.max(r, a)), c = Math.max(1, Math.round(r * o)), d = Math.max(1, Math.round(a * o));
    let u;
    try {
      u = await i.encode(s, c, d, n);
    } catch {
      throw new ne();
    }
    let p;
    try {
      p = Bs(new Uint8Array(await u.arrayBuffer()));
    } catch {
      throw new ne();
    }
    if (p.length > Fs) throw new ne();
    return p;
  } finally {
    s.close?.();
  }
}
async function Vs(t, e, n, i, s = Un) {
  if (t.shrinkingPhoto) return !1;
  let r;
  t.setShrinkingPhoto(!0);
  try {
    r = await js(i, 1024, 0.85, s);
  } catch {
    return t.showToast(Ln), !1;
  } finally {
    t.setShrinkingPhoto(!1);
  }
  return t.setPhoto(e, n, r);
}
function zn(t, e, n, i) {
  return l`<input class="file-input" type="file" accept="image/*" ?disabled=${i} @change=${(r) => {
    const a = r.target, o = a.files?.[0];
    a.value = "", o && Vs(t, e, n, o);
  }} />`;
}
const Gn = (t) => t.busy || t.shrinkingPhoto;
function St(t, e) {
  const { kind: n, id: i, name: s, photoUrl: r } = e, a = Gn(t);
  return l`<div class="photo-picker">
    ${S(s, r, 76)}
    <div class="actions">
      <label class="btn secondary file-btn" aria-disabled=${a ? "true" : "false"}>
        ${t.shrinkingPhoto ? "Preparing photo…" : r ? "Change photo" : "Add photo"} ${zn(t, n, i, a)}
      </label>
      ${r ? l`<button class="btn secondary" ?disabled=${a} @click=${() => void t.clearPhoto(n, i)}>Remove photo</button>` : h}
    </div>
  </div>`;
}
function qs(t, e, n = 76) {
  const { kind: i, id: s, name: r, photoUrl: a } = e, o = Gn(t), c = a ? "Change photo" : "Add photo";
  return l`<label class="file-btn photo-tap" aria-label=${c} title=${c} aria-disabled=${o ? "true" : "false"}>
    ${S(r, a, n)} ${zn(t, i, s, o)}
  </label>`;
}
function At(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const r of e) n.has(r.id) || n.set(r.id, r);
  const i = /* @__PURE__ */ new Set(), s = [];
  for (const r of t) {
    if (i.has(r)) continue;
    i.add(r);
    const a = n.get(r);
    a && s.push(a);
  }
  return s.sort(et);
}
const Fn = (t) => `edit:group:${t}`, ve = "edit:group:new", st = (t) => `confirm-delete:group:${t}`, je = (t, e) => l`<div class="label form-section">${t}</div>
    ${e}`;
function Bn(t, e, n) {
  const i = V(t, e), s = { ...i, error: (r) => r === "name" && n ? "Enter a name." : i.error(r) };
  return l`${M(s, "name", "Name", { required: !0, maxlength: 200 })}
  ${J(s, "description", "Description", 2e4)}`;
}
function Ks(t) {
  const n = !t.drafts.open(ve, f.newGroup(), () => ({ name: "", description: "" })).name.trim(), i = async () => {
    const s = t.drafts.get(ve);
    if (!s || !s.name.trim()) return;
    const r = await t.save("contact_group", null, { ...s });
    r && (t.drafts.drop(ve), U(f.editGroup(r.id), !0));
  };
  return {
    title: "New group",
    back: !0,
    actions: [],
    body: l`<div class="page form">
      ${Bn(t, ve, n)}
      <button class="btn" ?disabled=${n || t.busy} @click=${i}>Create group</button>
    </div>`
  };
}
function Ys(t, e) {
  const n = At(e.member_ids, $(t).people);
  return De(t, {
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
function Ws(t, e) {
  const n = st(e.id), i = e.member_ids.length;
  return N({
    title: `Delete ${e.name}?`,
    lines: [`${i} ${i === 1 ? "person stays" : "people stay"}; they just leave this group.`, "This can't be undone."],
    confirmLabel: "Delete group",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("contact_group", e.id) && (t.drafts.drop(n), t.drafts.drop(Fn(e.id)), t.setSearch({ chip: "groups" }), U(f.search(), !0));
    }
  });
}
function Js(t, e) {
  const n = $(t).groups.find((c) => c.id === e);
  if (!n) return t.isArriving(e) ? ue : G("group");
  const i = Fn(e), s = f.editGroup(e), a = !t.drafts.open(i, s, () => ({ name: n.name, description: n.description ?? "" })).name.trim(), o = async () => {
    const c = t.drafts.get(i), d = t.drafts.base(i);
    !c || !d || !c.name.trim() || await t.save("contact_group", e, { ...c }, { ...d }) && (t.drafts.drop(i), z(f.group(e)));
  };
  return {
    title: "Edit group",
    back: !0,
    actions: [],
    body: l`<div class="page form">
      ${je("Photo", St(t, { kind: "contact_group", id: e, name: n.name, photoUrl: n.photo_url }))}
      ${je("Details", Bn(t, i, a))}
      <button class="btn" ?disabled=${a || t.busy} @click=${o}>Save</button>
      ${je("Members", Ys(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(st(e), s, {})}>
        Delete group
      </button>
    </div>`,
    overlay: t.drafts.get(st(e)) ? Ws(t, n) : void 0
  };
}
const jn = (t) => ({
  name: t.trim(),
  phone: null,
  email: null,
  how_i_know_them: null,
  birthday: null,
  birth_year_unknown: !1
}), Xs = "Name (leave blank to use the generated name)", Vn = (t) => `edit:household:${t}`, ye = "edit:household:new", Le = (t) => `confirm-delete:household:${t}`, Ue = (t) => `confirm-dissolve:household:${t}`, ze = (t) => `confirm-move:household:${t}`, Ve = (t, e) => l`<div class="label form-section">${t}</div>
    ${e}`, rt = (t) => ({ name_override: t.name_override, address: t.address, notes: t.notes });
function qn(t, e) {
  const n = M(t, "name_override", Xs, { maxlength: 200 });
  return l`${e ? l`<div class="highlight">${n}</div>` : n} ${tt(t, "address", "Address")}
  ${J(t, "notes", "Notes", 2e4)}`;
}
function Zs(t) {
  const e = f.newHousehold();
  t.drafts.open(ye, e, () => ({ name_override: "", address: "", notes: "" }));
  const n = async () => {
    const i = t.drafts.get(ye);
    if (!i) return;
    const s = await t.save("household", null, rt(i));
    s && (t.drafts.drop(ye), U(f.editHousehold(s.id), !0));
  };
  return {
    title: "New household",
    back: !0,
    actions: [],
    body: l`<div class="page form">
      ${qn(V(t, ye), !1)}
      <button class="btn" ?disabled=${t.busy} @click=${n}>Create household</button>
    </div>`
  };
}
function Qs(t, e) {
  const n = f.editHousehold(e.id);
  let i = h;
  switch (e.name_status) {
    case "generated":
      i = l`<div class="muted" style="font-size:12.5px">Named from its members.</div>`;
      break;
    case "override":
      i = l`<div class="muted" style="font-size:12.5px">The name you gave it.</div>`;
      break;
    case "needs_name":
      i = l`<div class="warning household-status" style="font-size:12.5px">This household needs a name</div>`;
      break;
    case "not_a_household":
      i = l`<div class="warning household-status" style="font-size:12.5px">
          This isn't a household any more (one adult, no children)
        </div>
        <button
          class="btn secondary"
          style="justify-self:start"
          ?disabled=${t.busy}
          @click=${() => t.drafts.put(Ue(e.id), n, {})}
        >
          Dissolve household
        </button>`;
      break;
  }
  return l`<div style="display:grid;gap:6px">
    <div class="h-serif members-title ${X(e) ? "" : "muted"}" style="font-size:21px">${H(e)}</div>
    ${i}
  </div>`;
}
const at = (t, e, n) => t.save("person", e, { household_id: n });
function er(t, e) {
  const { people: n, relationships: i } = $(t), s = Ct(At(e.member_ids, n), e.member_ids, i, (o) => o), r = f.editHousehold(e.id), a = (o) => {
    const c = n.find((d) => d.id === o);
    if (c?.household_id && c.household_id !== e.id) {
      t.drafts.put(ze(e.id), r, { personId: o });
      return;
    }
    at(t, o, e.id);
  };
  return De(t, {
    id: "household-members",
    label: "Add a member",
    path: r,
    selected: s.map((o) => o.id),
    onPick: a,
    onRemove: (o) => void at(t, o, null),
    // A new person goes straight into this household, so they needn't be in the snapshot first.
    onCreate: (o) => void t.addPerson({ ...jn(o), household_id: e.id }),
    disabled: t.busy
  });
}
function tr(t, e, n) {
  const i = ze(e.id), s = $(t), r = s.households.find((o) => o.id === n.household_id), a = r ? $t(r, s.people) : "their household";
  return N({
    title: `Move ${n.name} from ${a} to this household?`,
    lines: ["A person can only be in one household."],
    confirmLabel: "Move",
    busy: t.busy,
    onCancel: () => t.drafts.drop(i),
    onConfirm: async () => {
      await at(t, n.id, e.id) && t.drafts.drop(i);
    }
  });
}
const nr = (t) => `${t} ${t === 1 ? "person stays" : "people stay"}; they just won't have a household.`;
function Kn(t, e) {
  for (const n of [Vn(e), Le(e), Ue(e), ze(e)]) t.drafts.drop(n);
  t.setSearch({ chip: "households" }), U(f.search(), !0);
}
function ir(t, e) {
  const n = Le(e.id);
  return N({
    title: `Delete ${H(e)}?`,
    lines: [nr(e.member_ids.length), "This can't be undone."],
    confirmLabel: "Delete household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && Kn(t, e.id);
    }
  });
}
function sr(t, e) {
  const n = Ue(e.id);
  return N({
    title: "Dissolve this household?",
    lines: ["Members stay; they just won't have a household."],
    confirmLabel: "Dissolve household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && Kn(t, e.id);
    }
  });
}
function rr(t, e) {
  const n = e.id;
  if (t.drafts.get(Le(n))) return ir(t, e);
  if (t.drafts.get(Ue(n))) return sr(t, e);
  const i = t.drafts.get(ze(n)), s = i && $(t).people.find((r) => r.id === i.personId);
  return s ? tr(t, e, s) : void 0;
}
function ar(t, e) {
  const n = $(t).households.find((a) => a.id === e);
  if (!n) return t.isArriving(e) ? ue : G("household");
  const i = Vn(e), s = f.editHousehold(e);
  t.drafts.open(i, s, () => ({
    name_override: n.name_override ?? "",
    address: n.address?.formatted ?? "",
    notes: n.notes ?? ""
  }));
  const r = async () => {
    const a = t.drafts.get(i), o = t.drafts.base(i);
    !a || !o || await t.save("household", e, rt(a), rt(o)) && (t.drafts.drop(i), z(f.household(e)));
  };
  return {
    title: "Edit household",
    back: !0,
    actions: [],
    body: l`<div class="page form">
      ${Qs(t, n)}
      ${Ve("Photo", St(t, { kind: "household", id: e, name: H(n), photoUrl: n.photo_url }))}
      ${Ve("Details", qn(V(t, i), n.name_status === "needs_name"))}
      <button class="btn" ?disabled=${t.busy} @click=${r}>Save</button>
      ${Ve("Members", er(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(Le(e), s, {})}>
        Delete household
      </button>
    </div>`,
    overlay: rr(t, n)
  };
}
function Yn(t, e, n, i) {
  const { people: s, relationships: r } = $(t), a = At(n, s), o = i ? Ct(a, n, r, (c) => c) : a;
  return {
    title: null,
    back: !0,
    actions: [{ icon: w.pencil, label: "Edit", href: e.editHref }],
    body: l`<div class="page">
      <div style="padding:16px">
        <div class="h-serif members-title ${e.muted ? "muted" : ""}" style="font-size:21px">${e.title}</div>
        ${e.subtitle ? l`<div class="muted" style="font-size:12.5px;margin-top:4px">${e.subtitle}</div>` : h}
        ${e.prompt ? l`<a class="warning name-prompt" style="display:block;font-size:12.5px;margin-top:4px" href=${e.prompt.href}>${e.prompt.text}</a>` : h}
        <!-- The members actually shown, not the raw id count. -->
        <div class="label" style="margin-top:6px">${Ne(o.length, "member").toUpperCase()}</div>
      </div>
      <div class="list">${o.map((c) => Qe(c))}</div>
    </div>`
  };
}
function or(t, e) {
  const n = $(t).households.find((a) => a.id === e);
  if (!n) return G("household");
  const i = f.editHousehold(e), s = n.name_status === "needs_name" ? { text: "This household needs a name. Name it", href: i } : n.name_status === "not_a_household" ? { text: "This isn't a household any more. Review it", href: i } : null, r = { title: H(n), muted: !X(n), subtitle: null, prompt: s, editHref: i };
  return Yn(t, r, n.member_ids, !0);
}
function lr(t, e) {
  const n = $(t).groups.find((i) => i.id === e);
  return n ? Yn(t, { title: n.name, muted: !1, subtitle: n.description, prompt: null, editHref: f.editGroup(e) }, n.member_ids, !1) : G("group");
}
function Wn(t) {
  if (!t) return null;
  if (t.startsWith("+")) {
    const n = t.slice(1).replace(/\D/g, "");
    return n.length >= 8 ? `+${n}` : null;
  }
  const e = t.replace(/\D/g, "");
  return e.length === 10 ? `+1${e}` : e.length === 11 && e.startsWith("1") ? `+${e}` : null;
}
function cr(t) {
  const e = Wn(t);
  return e ? `tel:${e}` : null;
}
function dr(t) {
  const e = Wn(t);
  return e ? `sms:${e}` : null;
}
function hr(t) {
  const e = t?.trim() ?? "";
  return e === "" || /\s/.test(e) ? null : `mailto:${e}`;
}
function Zt(t) {
  return t ? typeof t.lat == "number" && typeof t.lon == "number" ? !0 : (t.formatted?.trim() ?? "") !== "" : !1;
}
function ur(t, e) {
  return Zt(t.address) ? t.address : Zt(e?.address) ? e.address : null;
}
function pr(t, e) {
  const n = ur(t, e);
  if (!n) return null;
  const i = n.formatted ?? "";
  return typeof n.lat == "number" && typeof n.lon == "number" ? `https://maps.apple.com/?ll=${n.lat},${n.lon}&q=${encodeURIComponent(i)}` : i ? `https://maps.apple.com/?q=${encodeURIComponent(i)}` : null;
}
function be(t) {
  const e = t?.trim() ?? "";
  if (!e) return null;
  try {
    const n = new URL(e);
    return n.protocol === "http:" || n.protocol === "https:" ? n.href : null;
  } catch {
    return null;
  }
}
const fr = "/config/integrations/integration/hearth_crm", Jn = "contact missing", Xn = "create uncertain", ke = "confirm-google-enable", Ce = "confirm-google-clear";
function Zn(t) {
  switch (t) {
    case Jn:
      return "This contact was deleted in Google.";
    case Xn:
      return "Hearth couldn't confirm whether Google created this contact.";
    default:
      return t;
  }
}
function Qn(t) {
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
function mr(t) {
  const e = new Date(t);
  return Number.isNaN(e.getTime()) ? t : e.toLocaleString();
}
function ei(t) {
  const e = [`${t.created} created`, `${t.updated} updated`];
  return t.photos && e.push(`${t.photos} photos`), t.errors && e.push(`${t.errors} with errors`), t.missing && e.push(`${t.missing} missing in Google`), t.pending && e.push(`${t.pending} still to do`), e.join(", ");
}
function gr() {
  return l`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">
      Hearth can keep your contacts in your Google account up to date. It's optional, and Hearth works the same without it.
    </div>
    <div class="muted" style="font-size:12.5px">
      To connect: Settings → Devices & services → Hearth → Reconfigure.
    </div>
    <a class="accent" style="font-size:12.5px" href=${fr} target="_blank" rel="noopener noreferrer">Open Hearth in Home Assistant</a>
  </div>`;
}
function vr(t) {
  const { counts: e, last_run: n } = t, i = n ? Qn(n) : null;
  return l`<div id="google-status" style="display:grid;gap:4px;font-size:12.5px">
    <div>
      ${e.synced} synced, ${e.pending} waiting, ${e.skipped} skipped${e.missing ? l`, ${e.missing} missing in Google` : h}${e.errors ? l`, ${e.errors} with errors` : h}
    </div>
    ${t.running ? l`<div class="muted">Syncing now…</div>` : h}
    ${n && !n.dry_run ? l`<div class="muted">Last run ${mr(n.started_at)}: ${ei(n)}</div>` : l`<div class="muted">No sync has run yet.</div>`}
    ${i ? l`<div role="alert">${i}</div>` : h}
    ${t.last_error ? l`<div role="alert">The last run failed: ${t.last_error}</div>` : h}
  </div>`;
}
function yr(t, e) {
  const n = !e.cutover_confirmed && !e.enabled, i = (s) => {
    const r = s.target;
    r.checked ? (r.checked = !1, t.drafts.put(ke, f.settings(), {})) : t.setGoogleEnabled(!1);
  };
  return l`<div style="display:grid;gap:4px">
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
    ${n ? l`<div class="muted" id="google-enable-why" style="font-size:12.5px">
          Available once cutover is confirmed, so test edits in Hearth never reach your Google account. Run the Hearth “Confirm cutover” action (Developer tools → Actions) once your import is final. You can still preview below.
        </div>` : h}
  </div>`;
}
function br(t) {
  const e = t.created - t.would_create.length;
  return l`<div id="google-preview" role="status" style="display:grid;gap:6px;font-size:12.5px">
    <div>
      Would create ${t.created}, update ${t.updated}, skip ${t.skipped}${t.photos ? `, and ${t.photos} ${t.photos === 1 ? "photo" : "photos"} to upload` : h}
    </div>
    ${t.would_create.length ? l`<div class="muted">Would create:</div>
          <ul style="margin:0;padding-left:18px">
            ${t.would_create.map((n) => l`<li>${n}</li>`)}
          </ul>
          ${e > 0 ? l`<div class="muted" id="google-preview-more">and ${e} more</div>` : h}` : h}
  </div>`;
}
function $r(t) {
  const e = Qn(t);
  return l`<div id="google-sync-result" role="status" style="display:grid;gap:4px;font-size:12.5px">
    <div>Sync finished: ${ei(t)}</div>
    ${e ? l`<div>${e}</div>` : h}
  </div>`;
}
function _r(t) {
  return $(t).people.filter((e) => e.google_sync_error);
}
function wr(t) {
  const e = _r(t);
  return e.length ? l`<div id="google-problems" style="display:grid;gap:10px">
    <div class="label" style="padding:0">Needs attention</div>
    ${e.map((n) => {
    const i = n.google_sync_error, s = i === Xn && !n.google_contact_id, r = s || i === Jn && !!n.google_contact_id;
    return l`<div class="google-problem" style="display:flex;align-items:center;gap:10px">
        <span style="flex:1;min-width:0">
          <a href=${f.person(n.id)} style="font-weight:600">${n.name}</a>
          <div class="muted" style="font-size:12.5px">${Zn(i)}</div>
        </span>
        ${r ? l`<button
              class="btn secondary"
              ?disabled=${t.busy}
              @click=${() => t.drafts.put(Ce, f.settings(), { personId: n.id, uncertain: s })}
            >
              Create a new contact
            </button>` : h}
      </div>`;
  })}
  </div>` : h;
}
function xr(t) {
  const { status: e, loadError: n, preview: i, lastSync: s, working: r } = t.google;
  return e ? e.connected ? l`<div class="card" style="padding:13px;display:grid;gap:12px">
    ${n ? l`<div class="muted" id="google-refresh-error" role="status" style="font-size:12.5px">Couldn't refresh Google status</div>` : h}
    ${vr(e)} ${yr(t, e)}
    <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn secondary" id="google-preview-btn" ?disabled=${t.busy || r !== null} @click=${() => void t.previewGoogle()}>
        ${r === "preview" ? "Previewing…" : "Preview"}
      </button>
      <button
        class="btn"
        id="google-sync-btn"
        ?disabled=${t.busy || r !== null || !e.enabled}
        @click=${() => void t.syncGoogleNow()}
      >
        ${r === "sync" ? "Syncing…" : "Sync now"}
      </button>
    </div>
    ${i ? br(i) : h} ${s ? $r(s) : h} ${wr(t)}
  </div>` : gr() : l`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${n ? `Couldn't load the Google sync status: ${n}` : "Loading…"}</div>
    </div>`;
}
function kr(t) {
  if (t.drafts.get(ke))
    return N({
      title: "Turn on Google sync?",
      lines: ["Contacts will be created and updated in your Google account. Hearth never deletes a Google contact."],
      confirmLabel: "Turn on",
      busy: t.busy,
      onCancel: () => t.drafts.drop(ke),
      onConfirm: () => {
        t.drafts.drop(ke), t.setGoogleEnabled(!0);
      }
    });
  const e = t.drafts.get(Ce);
  if (e)
    return N({
      title: "Create a new contact?",
      lines: [
        e.uncertain ? "Hearth couldn't confirm whether Google created this contact. Check Google Contacts for a stray copy first; a new one will be created." : "A new contact will be created in Google. The old one is not touched."
      ],
      confirmLabel: "Create new contact",
      busy: t.busy,
      onCancel: () => t.drafts.drop(Ce),
      onConfirm: () => {
        t.drafts.drop(Ce), t.clearGoogleContact(e.personId);
      }
    });
}
function $e(t, e, n) {
  return l`<a class="action" href=${n} target="_blank" rel="noopener noreferrer" aria-label=${e} title=${e}
    >${t}</a
  >`;
}
function Cr(t, e) {
  const n = cr(t.phone), i = dr(t.phone), s = hr(t.email), r = pr(t, e);
  return l`<div class="actions-row">
    <a class="action primary" href=${f.logInteraction(t.id)} aria-label="Log interaction" title="Log interaction"
      >${w.plus}</a
    >
    <a class="action" href=${f.newReminder(t.id)} aria-label="Add reminder" title="Add reminder">${w.bell}</a>
    ${n ? $e(w.phone, "Call", n) : h} ${i ? $e(w.message, "Message", i) : h}
    ${s ? $e(w.envelope, "Email", s) : h} ${r ? $e(w.mapPin, "Map", r) : h}
  </div>`;
}
function Er(t, e) {
  const n = e.person;
  return l`<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
    <a class="connection" href=${f.person(n.id)} style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
      ${S(n.name, n.photo_url, 28)}
      <span style="flex:1;font-weight:600;font-size:13px">${n.name}</span>
    </a>
    ${e.connectionType && e.relationshipId ? l`<a
          class="connection-type mono muted"
          style="font-size:9px;padding:6px 0 6px 8px"
          href=${f.relationship(t, e.relationshipId)}
          aria-label=${`Edit relationship with ${n.name}`}
          >${e.connectionType.toUpperCase()}</a
        >` : h}
  </div>`;
}
const Qt = l`<div style="border-top:1px solid var(--border);margin:9px 0"></div>`;
function Sr(t) {
  const e = X(t);
  return l`<a href=${f.household(t.id)} style="display:flex;justify-content:space-between;padding-bottom:2px">
    <span class="mono household-name ${e ? "accent" : "muted"}" style="font-size:9.5px"
      >${e ? H(t).toUpperCase() : H(t)}</span
    >
    <span class="mono muted" style="font-size:9px">HOUSEHOLD</span>
  </a>`;
}
function Ar(t, e) {
  const { people: n, households: i, groups: s, relationships: r, me_person_id: a } = e, o = Us(t.id, { people: n, households: i, groups: s, relationships: r, excludedId: a }), c = (u) => Er(t.id, u), d = l`<a class="accent add-relationship" href=${f.newRelationship(t.id)} style="display:block;font-size:12.5px;padding:8px 20px 18px"
    >Add relationship</a
  >`;
  return Ls(o) ? l`<div class="label" style="padding:0 20px 8px">Connections</div>${d}` : l`<div class="label" style="padding:0 20px 8px">Connections</div>
    <div class="card">
      ${o.household ? l`${Sr(o.household)} ${o.householdMembers.map(c)}` : h}
      ${o.others.length ? l`${o.household ? l`${Qt}<div class="mono muted" style="font-size:9.5px">ELSEWHERE</div>` : h}
          ${o.others.map(c)}` : h}
      ${o.groups.length ? l`${o.household || o.others.length ? Qt : h}
            <div class="mono muted" style="font-size:9.5px;padding-bottom:5px">GROUPS</div>
            <div class="chips">
              ${o.groups.map(
    (u) => l`<a class="chip" href=${f.group(u.id)}
                    >${u.name}<span class="mono muted" style="font-size:8.5px">${u.member_ids.length}</span></a
                  >`
  )}
            </div>` : h}
    </div>
    ${d}`;
}
function Tr(t) {
  const n = [
    [be(t.website), w.globe, "Website"],
    [be(t.linkedin), w.linkedIn, "LinkedIn profile"],
    [be(t.facebook), w.facebook, "Facebook profile"],
    [be(t.instagram), w.instagram, "Instagram profile"]
  ].filter(([i]) => i);
  return n.length ? l`<div style="display:flex;gap:14px;padding:0 20px 18px">
    ${n.map(
    ([i, s, r]) => l`<a class="accent" style="width:22px;height:22px;display:inline-flex" href=${i ?? ""} target="_blank" rel="noopener noreferrer" aria-label=${r} title=${r}
          >${s}</a
        >`
  )}
  </div>` : h;
}
function Rr(t) {
  return t.length ? l`<div class="label" style="padding:0 20px 8px">Timeline</div>
    <div style="display:grid;gap:16px;padding:0 20px 20px">
      ${t.map(
    (e) => l`<a href=${f.interaction(e.id)} style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:11px;height:11px;border:2px solid var(--accent);border-radius:50%;margin-top:3px;flex:none"></span>
          <span>
            <div class="mono muted" style="font-size:9.5px">${Yi(e.date).toUpperCase()} · ${e.type.toUpperCase()}</div>
            <div style="font-weight:600;font-size:13px">${e.summary}</div>
          </span>
        </a>`
  )}
    </div>` : h;
}
function Tt(t, e, n) {
  const i = $(t), s = i.people.find((c) => c.id === e);
  if (!s) return t.isArriving(e) ? ue : G("person");
  const r = s.household_id ? i.households.find((c) => c.id === s.household_id) ?? null : null, a = [s.occupation, s.employer].filter(Boolean).join(" - "), o = s.how_i_know_them?.trim();
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
    body: l`<div class="page">
      <div style="display:grid;justify-items:center;gap:6px;padding:8px 20px 18px;text-align:center">
        ${qs(t, { kind: "person", id: s.id, name: s.name, photoUrl: s.photo_url })}
        <div class="h-serif" style="font-size:21px">${s.name}</div>
        ${a ? l`<div class="muted" style="font-size:12.5px">${a}</div>` : h}
        ${o ? l`<div class="muted" style="font-size:12.5px">${o}</div>` : h}
        ${s.birthday ? l`<div class="muted" style="font-size:12.5px">${Wi(s.birthday, s.birth_year_unknown, s.age)}</div>` : h}
        ${s.close_friend ? l`<div class="mono accent" style="font-size:10px;padding:4px 12px;border:1px dashed var(--thread);border-radius:999px;margin-top:4px">
              ◆ Close Friend rotation
            </div>` : h}
      </div>
      ${s.google_sync_error ? l`<a class="notice google-error" href=${f.settings()} style="display:block">Google sync: ${Zn(s.google_sync_error)}</a>` : h}
      ${Cr(s, r)}
      ${s.relationship_summary ? l`<div class="label" style="padding:0 20px 8px">Relationship summary</div>
            <div class="card" style="border-left:3px solid var(--accent);padding:14px;font-size:12.5px;white-space:pre-wrap">${s.relationship_summary}</div>` : h}
      ${In(t, i.reminders.filter((c) => c.person_id === s.id && c.state !== "done"), "padding:0 20px 8px", "padding:0")}
      ${Ar(s, i)} ${Tr(s)} ${Rr(hs(i.interactions, s.id))}
    </div>`,
    overlay: n === "log" ? Pn(t, s, null) : void 0
  };
}
const ot = "new", ti = [
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
], Mr = ["favorite", "close_friend"], Rt = (t) => `edit:person:${t}`, lt = (t) => `confirm-delete:person:${t}`;
function Nr(t, e) {
  return t.groups.filter((n) => n.member_ids.includes(e)).map((n) => n.id);
}
function Pr(t, e) {
  return {
    ...Object.fromEntries(ti.map((i) => [i, t[i] ?? ""])),
    favorite: t.favorite,
    close_friend: t.close_friend,
    birthday: t.birthday ?? "",
    birth_year_unknown: t.birth_year_unknown,
    address: t.address?.formatted ?? "",
    school: t.school?.formatted ?? "",
    household_id: t.household_id ?? "",
    group_ids: Nr(e, t.id),
    saving: !1
  };
}
function en(t, e) {
  const n = {};
  for (const i of ti) n[i] = t[i];
  for (const i of Mr) n[i] = t[i];
  return n.birthday = t.birthday, n.birth_year_unknown = t.birthday !== "" && t.birth_year_unknown, n.address = t.address, n.school = t.school, n.household_id = e, n;
}
function Ir(t, e) {
  const n = t.relationships.filter((c) => c.person_a_id === e || c.person_b_id === e).length, i = t.groups.filter((c) => c.member_ids.includes(e)).length, s = t.interactions.filter((c) => c.person_ids.includes(e)), r = s.filter((c) => c.person_ids.every((d) => d === e)).length, a = s.length - r, o = (c, d, u) => `${c} ${c === 1 ? d : u}`;
  return `Also removes ${o(n, "relationship", "relationships")} and ${o(i, "group membership", "group memberships")}. ${o(r, "interaction with only them is", "interactions with only them are")} deleted; ${o(a, "shared interaction keeps", "shared interactions keep")} the other people.`;
}
function Hr(t, e) {
  const n = e.household_id ? t.households.find((i) => i.id === e.household_id) : void 0;
  return n ? [`They leave ${$t(n, t.people)}.`] : [];
}
function Or(t, e) {
  const n = lt(e.id), i = $(t);
  return N({
    title: `Delete ${e.name}?`,
    lines: [Ir(i, e.id), ...Hr(i, e), "This can't be undone."],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("person", e.id) && (t.drafts.drop(n), t.drafts.drop(Rt(e.id)), U(f.home(), !0));
    }
  });
}
async function Dr(t, e) {
  const n = Rt(e.id), i = t.drafts.get(n), s = t.drafts.base(n);
  if (!(!i || !s || i.saving || !i.name.trim())) {
    t.drafts.patch(n, { saving: !0 });
    try {
      let r = i.household_id || null;
      if (r === ot) {
        const o = await t.save("household", null, {});
        if (!o) return;
        r = o.id, t.drafts.patch(n, { household_id: r });
      }
      const a = en(s, s.household_id || null);
      if (!await t.save("person", e.id, en(i, r), a)) return;
      for (const o of $(t).groups) {
        const c = i.group_ids.includes(o.id);
        if (s.group_ids.includes(o.id) === c) continue;
        const d = t.groupMembers(o.id);
        if (d.includes(e.id) === c) continue;
        const u = c ? [...d, e.id] : d.filter((p) => p !== e.id);
        if (!await t.setGroupMembers(o.id, u)) return;
      }
      t.drafts.drop(n), z(f.person(e.id));
    } finally {
      t.drafts.patch(n, { saving: !1 });
    }
  }
}
const P = (t, e) => l`<div class="label form-section">${t}</div>
    ${e}`;
function Lr(t, e) {
  const n = t.households.map((i) => ({ value: i.id, label: $t(i, t.people) })).sort((i, s) => L(i.label, s.label));
  return e && e !== ot && !n.some((i) => i.value === e) && n.push({ value: e, label: "New household" }), [{ value: "", label: "None" }, ...n, { value: ot, label: "New household…" }];
}
function Ur(t, e, n, i) {
  if (!n.groups.length) return l`<div class="muted" style="font-size:12.5px">No groups yet.</div>`;
  const s = [...n.groups].sort((a, o) => L(a.name, o.name)), r = (a, o) => {
    const c = t.drafts.get(e)?.group_ids ?? [], d = o ? [...c.filter((u) => u !== a), a] : c.filter((u) => u !== a);
    t.drafts.patch(e, { group_ids: d });
  };
  return l`<div role="group" aria-label="Groups">
    ${s.map(
    (a) => l`<label class="check">
        <input
          type="checkbox"
          data-group=${a.id}
          .checked=${k(i.includes(a.id))}
          @change=${(o) => r(a.id, o.target.checked)}
        />
        ${a.name}
      </label>`
  )}
  </div>`;
}
function zr(t, e) {
  const n = $(t), i = n.people.find((p) => p.id === e);
  if (!i) return t.isArriving(e) ? ue : G("person");
  const s = Rt(e), r = f.editPerson(e), a = t.drafts.open(s, r, () => Pr(i, n)), o = !a.name.trim(), c = V(t, s), d = { ...c, error: (p) => p === "name" && o ? "Enter a name." : c.error(p) }, u = o || a.saving || t.busy;
  return {
    title: "Edit person",
    back: !0,
    actions: [],
    body: l`<div class="page form">
      ${P("Photo", St(t, { kind: "person", id: e, name: i.name, photoUrl: i.photo_url }))}
      ${P(
      "Basics",
      l`${M(d, "name", "Name", { required: !0, maxlength: 200 })}
        ${M(d, "how_i_know_them", "How I know them", { maxlength: 2e3 })}
        ${M(d, "occupation", "Occupation", { maxlength: 300 })} ${M(d, "employer", "Employer", { maxlength: 300 })}`
    )}
      ${P(
      "Contact",
      l`${M(d, "phone", "Phone", { type: "tel", autocomplete: "tel", maxlength: 50 })}
        ${M(d, "phone2", "Phone 2", { type: "tel", maxlength: 50 })}
        ${M(d, "email", "Email", { type: "email", autocomplete: "email", maxlength: 500 })}
        ${M(d, "email2", "Email 2", { type: "email", maxlength: 500 })}`
    )}
      ${P("Dates", vs(d, "birthday", "Birthday", "birth_year_unknown"))}
      ${P(
      "Flags",
      l`${nt(d, "favorite", "Favorite")} ${nt(d, "close_friend", "Close friend")}`
    )}
      ${P("Places", l`${tt(d, "address", "Address")} ${tt(d, "school", "School")}`)}
      ${P(
      "Links",
      l`${ge(d, "website", "Website")} ${ge(d, "linkedin", "LinkedIn")} ${ge(d, "facebook", "Facebook")}
        ${ge(d, "instagram", "Instagram")}`
    )}
      ${P(
      "Notes and summary",
      l`${J(d, "notes", "Notes", 2e4)} ${J(d, "relationship_summary", "Relationship summary", 2e4)}`
    )}
      ${P("Household", wt(d, "household_id", "Household", Lr(n, a.household_id)))}
      ${P("Groups", Ur(t, s, n, a.group_ids))}
      <button class="btn" ?disabled=${u} @click=${() => void Dr(t, i)}>Save</button>
      <button
        class="btn danger"
        style="margin-top:24px"
        ?disabled=${t.busy}
        @click=${() => t.drafts.put(lt(e), r, {})}
      >
        Delete person
      </button>
    </div>`,
    overlay: t.drafts.get(lt(e)) ? Or(t, i) : void 0
  };
}
const Gr = (t, e) => `edit:relationship:${t}:${e ?? "new"}`, ct = (t) => `confirm-delete:relationship:${t}`;
function Fr(t, e, n) {
  const i = Tt(t, e, null), s = $(t), r = s.people.find((c) => c.id === e);
  if (!r) return i;
  let a, o = null;
  return n !== null && (a = s.relationships.find((c) => c.id === n), o = a ? Oe(a, e) : null, !a || !o) ? i : { ...i, overlay: Br(t, r, a ?? null, o) };
}
function Br(t, e, n, i) {
  const s = $(t), r = n?.id ?? null, a = Gr(e.id, r), o = n ? f.relationship(e.id, n.id) : f.newRelationship(e.id), c = t.drafts.open(a, o, () => ({
    other: i?.otherId ?? "",
    type: i?.type ?? "",
    notes: n?.notes ?? ""
  })), d = s.people.find((v) => v.id === c.other), u = s.relationships.flatMap((v) => {
    const T = Oe(v, e.id);
    return T && T.otherId !== i?.otherId ? [T.otherId] : [];
  }), p = [{ value: "", label: "Choose…" }, ...s.connection_types.map((v) => ({ value: v, label: v }))];
  c.type && !s.connection_types.includes(c.type) && p.push({ value: c.type, label: c.type });
  const y = () => {
    t.drafts.drop(a), z(f.person(e.id));
  }, m = !!d && c.type !== "", g = async () => {
    const v = t.drafts.get(a), T = t.drafts.base(a);
    if (!v || !T || !v.other || !v.type) return;
    const ci = v.other !== T.other || v.type !== T.type, Mt = { person_a_id: e.id, person_b_id: v.other, type: v.type };
    (await t.save(
      "relationship",
      r,
      { ...Mt, notes: v.notes },
      ci ? { notes: T.notes } : { ...Mt, notes: T.notes }
    ) || r && !$(t).relationships.some((di) => di.id === r)) && y();
  }, C = V(t, a), b = Pe(e.name);
  return l`<div class="sheet-backdrop" @click=${(v) => v.target === v.currentTarget && y()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit relationship" : "Add relationship"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${y}>Cancel</button>
        <span class="title" style="text-align:center">${n ? "Relationship" : "Add relationship"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!m || t.busy} @click=${g}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          ${De(t, {
    id: "relationship-person",
    label: "Person",
    path: o,
    exclude: [e.id, ...u],
    selected: d ? [d.id] : [],
    onPick: (v) => t.drafts.patch(a, { other: v }),
    onRemove: () => t.drafts.patch(a, { other: "" }),
    // Just a name: the rest can be filled in from their own screen later.
    onCreate: async (v) => {
      const T = await t.addPerson(jn(v));
      T && t.drafts.patch(a, { other: T });
    },
    disabled: t.busy
  })}
          <div class="muted" style="font-size:12.5px">${d ? d.name : "Someone"} is ${b}'s</div>
          ${wt(C, "type", "Type", p)} ${J(C, "notes", "Notes", 2e4)}
          ${n ? l`<button
                class="btn danger"
                style="margin-top:12px"
                ?disabled=${t.busy}
                @click=${() => t.drafts.put(ct(n.id), o, {})}
              >
                Remove relationship
              </button>` : h}
        </div>
      </div>
    </div>
  </div>
  ${n && t.drafts.get(ct(n.id)) ? jr(t, e, s.people.find((v) => v.id === i?.otherId), n, y) : h}`;
}
function jr(t, e, n, i, s) {
  const r = ct(i.id), a = n?.name ?? "them";
  return N({
    title: `Remove the link between ${e.name} and ${a}?`,
    lines: ["Both people stay in Hearth. Only this relationship is removed. This can't be undone."],
    confirmLabel: "Remove",
    busy: t.busy,
    onCancel: () => t.drafts.drop(r),
    onConfirm: async () => {
      await t.remove("relationship", i.id) && (t.drafts.drop(r), s());
    }
  });
}
function tn(t, e) {
  const n = t.contact_status, i = e ? "var(--danger)" : "var(--warning)";
  return l`<a class="row" href=${f.person(t.id)}>
    <span style="width:3px;height:36px;border-radius:2px;background:${i};flex:none"></span>
    ${S(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${n.last_contacted ? `Last: ${Ae(n.last_contacted)}` : "No interactions yet"}</div>
    </span>
    <span class="meta" style="color:${i}">${n.days_since_contact === null ? "—" : `${n.days_since_contact}d`}</span>
  </a>`;
}
const nn = (t, e) => (t.contact_status.days_since_contact ?? 1 / 0) - (e.contact_status.days_since_contact ?? 1 / 0);
function ni(t) {
  const e = $(t).people.filter((s) => s.close_friend), n = e.filter((s) => s.contact_status.urgency === "overdue").sort(nn), i = e.filter((s) => s.contact_status.urgency === "due_soon").sort(nn);
  return {
    title: "Reach out",
    back: !1,
    actions: [],
    body: l`<div class="page">
      <div class="reach-card">
        <div class="mono accent" style="font-size:10px">CLOSE FRIEND ROTATION · ~6WK CADENCE</div>
        <div class="h-serif" style="font-size:17px;margin-top:6px">${Ne(n.length, "person", "people")} overdue</div>
      </div>
      ${n.length ? l`<div class="label list-label">Overdue</div>
            <div class="list">${n.map((s) => tn(s, !0))}</div>` : h}
      ${i.length ? l`<div class="label list-label">Due soon</div>
            <div class="list">${i.map((s) => tn(s, !1))}</div>` : h}
      ${!n.length && !i.length ? l`<div class="empty">Everyone's been in touch recently.</div>` : h}
    </div>`
  };
}
function Vr(t, e) {
  const n = $(t);
  switch (e.name) {
    case "reminderNew": {
      const i = Tt(t, e.personId, null), s = n.people.find((a) => a.id === e.personId);
      if (!s) return i;
      const r = f.newReminder(s.id);
      return { ...i, overlay: qe(t, { key: `reminder:new:person:${s.id}`, path: r, closeTo: f.person(s.id), person: s, interaction: null, existing: null }) };
    }
    case "interactionReminderNew": {
      const i = Hn(t, e.interactionId, null), s = n.interactions.find((o) => o.id === e.interactionId);
      if (!s) return i;
      const r = Ie(s, n.people)[0] ?? null, a = f.newInteractionReminder(s.id);
      return {
        ...i,
        overlay: qe(t, { key: `reminder:new:interaction:${s.id}`, path: a, closeTo: f.interaction(s.id), person: r, interaction: s, existing: null })
      };
    }
    case "reminder": {
      const i = n.reminders.find((o) => o.id === e.id);
      if (!i) return t.isArriving(e.id) ? ue : G("reminder");
      const s = n.people.find((o) => o.id === i.person_id) ?? null, r = i.interaction_id ? n.interactions.find((o) => o.id === i.interaction_id) ?? null : null, a = { key: `edit:reminder:${i.id}`, path: f.reminder(i.id), closeTo: f.reachOut(), person: s, interaction: r, existing: i };
      return { ...ni(t), overlay: qe(t, a) };
    }
  }
}
const dt = (t) => `confirm-delete:reminder:${t}`;
function qe(t, e) {
  const n = $(t), { key: i, path: s, existing: r, interaction: a } = e, o = t.drafts.open(i, s, () => ({
    ...r ? Es(r) : Rn(),
    person: e.person?.id ?? r?.person_id ?? ""
  })), c = e.person ?? n.people.find((m) => m.id === o.person) ?? null, d = () => {
    t.drafts.drop(i), z(e.closeTo);
  }, u = !!c && re(o) !== null, p = async () => {
    const m = t.drafts.get(i), g = m && re(m);
    if (!m || !g || !c) return;
    if (r) {
      const b = t.drafts.base(i);
      await t.updateReminder(r.id, g, (b && re(b)) ?? void 0) && d();
      return;
    }
    await t.addReminder({ person_id: c.id, interaction_id: a?.id ?? null, ...g }) && d();
  }, y = V(t, i);
  return l`<div class="sheet-backdrop" @click=${(m) => m.target === m.currentTarget && d()}>
      <div class="sheet" role="dialog" aria-label=${r ? "Edit reminder" : "Add reminder"}>
        <div class="topbar">
          <button class="icon-btn" style="padding:0 12px" @click=${d}>Cancel</button>
          <span class="title" style="text-align:center">${r ? "Reminder" : "Add reminder"}</span>
          <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!u || t.busy} @click=${p}>
            Save
          </button>
        </div>
        <div class="sheet-body">
          <div class="form">
            ${e.person || r ? l`<div class="field">
                  <span>Person</span>
                  ${c ? l`<div style="display:flex;align-items:center;gap:10px">${S(c.name, c.photo_url, 26)} ${c.name}</div>` : l`<div class="muted">No longer in Hearth</div>`}
                </div>` : De(t, {
    id: "reminder-person",
    label: "Person",
    path: s,
    selected: c ? [c.id] : [],
    onPick: (m) => t.drafts.patch(i, { person: m }),
    onRemove: () => t.drafts.patch(i, { person: "" }),
    disabled: t.busy
  })}
            ${a ? l`<div class="muted" style="font-size:12.5px">From: ${a.summary}</div>` : h}
            ${Nn(y, n.today, n.reminder_units, t.busy)}
            ${r ? l`<button
                  class="btn danger"
                  style="margin-top:12px"
                  ?disabled=${t.busy}
                  @click=${() => t.drafts.put(dt(r.id), s, {})}
                >
                  Delete reminder
                </button>` : h}
          </div>
        </div>
      </div>
    </div>
    ${r && t.drafts.get(dt(r.id)) ? qr(t, r, c, d) : h}`;
}
function qr(t, e, n, i) {
  const s = dt(e.id), r = e.note ? `“${e.note}”` : "This reminder";
  return N({
    title: "Delete this reminder?",
    lines: [`${r}${n ? ` for ${n.name}` : ""} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(s),
    onConfirm: async () => {
      await t.deleteReminder(e.id) && (t.drafts.drop(s), i());
    }
  });
}
const Kr = [
  ["people", "People"],
  ["households", "Households"],
  ["groups", "Groups"]
], sn = (t, e) => e === "" || t.toLocaleLowerCase().includes(e.toLocaleLowerCase());
function Yr(t) {
  const e = H(t);
  return l`<a class="row" href=${f.household(t.id)}>
    ${S(e, t.photo_url)}
    <span class="main"><div class="name ${X(t) ? "" : "muted"}">${e}</div></span>
    <span class="meta">${Ne(t.member_ids.length, "member")}</span>
  </a>`;
}
function Wr(t) {
  return l`<a class="row" href=${f.group(t.id)}>
    ${S(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      ${t.description ? l`<div class="sub">${t.description}</div>` : h}
    </span>
    <span class="meta">${Ne(t.member_ids.length, "member")}</span>
  </a>`;
}
function Jr(t) {
  const { people: e, households: n, groups: i, relationships: s } = $(t), r = t.search.text.trim();
  switch (t.search.chip) {
    case "people": {
      const a = Et(r, e, s);
      return l`${a.direct.map((o) => Qe(o))}
      ${a.connected.length ? l`${es("Connected")} ${a.connected.map((o) => Qe(o.person, o.reason))}` : h}
      ${a.direct.length + a.connected.length === 0 ? l`<div class="empty">No one matches “${r}”.</div>` : h}`;
    }
    case "households":
      return n.map((a) => ({ h: a, name: H(a) })).filter(({ name: a }) => sn(a, r)).sort((a, o) => L(a.name, o.name)).map(({ h: a }) => Yr(a));
    case "groups":
      return i.filter((a) => sn(a.name, r)).sort((a, o) => L(a.name, o.name)).map(Wr);
  }
}
function Xr(t) {
  if (t === "people") return h;
  const [e, n] = t === "households" ? ["New household", f.newHousehold()] : ["New group", f.newGroup()];
  return l`<div style="padding:0 16px 8px"><a class="btn secondary new-record" style="display:inline-flex;align-items:center" href=${n}>${e}</a></div>`;
}
function Zr(t) {
  const { text: e, chip: n } = t.search;
  return {
    title: null,
    back: !1,
    actions: [],
    body: l`<div class="page">
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
        ${Kr.map(
      ([i, s]) => l`<button
            class="pill mono ${n === i ? "on" : ""}"
            aria-pressed=${n === i ? "true" : "false"}
            @click=${() => t.setSearch({ chip: i })}
          >
            ${s}
          </button>`
    )}
      </div>
      ${Xr(n)}
      <div class="list">${Jr(t)}</div>
    </div>`
  };
}
const Qr = new URL(import.meta.url).searchParams.get("v"), ea = [
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
function ta(t) {
  const { status: e, loadError: n, testing: i } = t.notifications;
  if (!e)
    return l`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${n ? `Couldn't load the notification settings: ${n}` : "Loading…"}</div>
    </div>`;
  const s = e.devices === 0;
  return l`<div class="card" style="padding:13px;display:grid;gap:14px">
    ${s ? l`<div class="muted" id="notify-no-phone" role="status" style="font-size:12.5px">
          No phone is set up for notifications. Install the Home Assistant Companion app and sign in as yourself.
        </div>` : h}
    ${ea.map(({ kind: r, id: a, label: o, help: c }) => {
    const d = e.settings[r];
    return l`<div style="display:grid;gap:6px">
        <label class="check">
          <input
            id=${a}
            type="checkbox"
            role="switch"
            ?disabled=${t.busy}
            .checked=${k(d.enabled)}
            @change=${(u) => void t.setNotification(r, { enabled: u.target.checked })}
          />
          <span>${o}</span>
        </label>
        <div class="muted" style="font-size:12.5px">${c}</div>
        <label class="field">
          <span>Time</span>
          <input
            id=${`${a}-time`}
            class="input"
            type="time"
            step="60"
            ?disabled=${t.busy}
            .value=${k(d.time)}
            @change=${(u) => {
      const p = u.target.value;
      p && t.setNotification(r, { time: p });
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
const na = 8, _e = "me-picker";
function ia(t) {
  const { people: e, relationships: n, me_person_id: i } = $(t), s = i ? e.find((u) => u.id === i) : void 0, r = t.drafts.get(_e)?.query ?? null, a = () => t.drafts.drop(_e), o = async (u) => {
    await t.setMe(u) && a();
  }, c = l`<div style="display:flex;align-items:center;gap:12px">
    ${s ? l`${S(s.name, s.photo_url, 36)}<span style="flex:1;font-weight:600">${s.name}</span>` : l`<span class="muted" style="flex:1">Not set</span>`}
    ${r === null ? l`<button class="btn secondary" @click=${() => t.drafts.put(_e, f.settings(), { query: "" })}>Change</button>
          ${s ? l`<button class="btn secondary" ?disabled=${t.busy} @click=${() => o(null)}>Clear</button>` : h}` : h}
  </div>`;
  if (r === null) return l`<div class="card" style="padding:13px">${c}</div>`;
  const d = Et(r.trim(), e, n).direct.slice(0, na);
  return l`<div class="card" style="padding:13px;display:grid;gap:10px">
    ${c}
    <input
      id="me-search"
      class="input"
      type="search"
      placeholder="Search people"
      aria-label="Search people"
      autocomplete="off"
      .value=${k(r)}
      @input=${(u) => t.drafts.patch(_e, { query: u.target.value })}
    />
    <div class="list">
      ${d.length ? d.map(
    (u) => l`<button class="row me-choice" style="width:100%;text-align:left" ?disabled=${t.busy} @click=${() => o(u.id)}>
              ${S(u.name, u.photo_url)}<span class="main"><div class="name">${u.name}</div></span>
            </button>`
  ) : l`<div class="empty">No one matches “${r.trim()}”.</div>`}
    </div>
    <button class="btn secondary" @click=${a}>Cancel</button>
  </div>`;
}
function sa(t) {
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
const Te = "confirm-import";
function ra(t, e) {
  return N({
    title: `Import ${e.name}?`,
    lines: ["Everything in your Hearth is replaced by what's in this file."],
    confirmLabel: "Import",
    busy: t.busy,
    onCancel: () => t.drafts.drop(Te),
    onConfirm: () => {
      t.drafts.drop(Te), t.importBundle(e, !1);
    }
  });
}
function aa(t) {
  const e = t.importState, n = e.kind === "uploading", i = (s) => {
    const r = s.target, a = r.files?.[0];
    r.value = "", a && t.drafts.put(Te, f.settings(), { file: a });
  };
  return l`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">Replaces everything in your Hearth with a Hearth export (.zip).</div>
    <input
      id="import-file"
      type="file"
      accept=".zip,application/zip"
      aria-label="Choose a Hearth export to import"
      ?disabled=${t.busy}
      @change=${i}
    />
    ${n ? l`<div class="notice" role="status" style="margin:0">Uploading and importing…</div>` : h}
    ${e.kind === "done" ? l`<div class="notice" role="status" style="margin:0">${e.summary}</div>` : h}
    ${e.kind === "refused" ? l`<div role="alert" style="display:grid;gap:8px">
          <div>${sa(e)}</div>
          ${e.reason === "invalid" && e.problems.length ? l`<ul class="muted" style="margin:0;padding-left:18px;font-size:12.5px">
                ${e.problems.map((s) => l`<li>${s}</li>`)}
              </ul>` : h}
          ${e.reason === "local_changes" ? l`<div class="actions" style="display:flex;gap:8px">
                <button class="btn secondary" ?disabled=${t.busy} @click=${() => t.clearImport()}>Cancel</button>
                <button class="btn danger" ?disabled=${t.busy} @click=${() => void t.importBundle(e.file, !0)}>Replace everything</button>
              </div>` : h}
        </div>` : h}
  </div>`;
}
function oa(t) {
  const e = t.drafts.get(Te);
  return {
    overlay: e ? ra(t, e.file) : kr(t),
    title: "Settings",
    back: !0,
    actions: [],
    body: l`<div class="page">
      <div class="label" style="padding:16px 20px 8px">This is me</div>
      ${ia(t)}

      <div class="label" style="padding:0 20px 8px">Notifications</div>
      ${ta(t)}

      <div class="label" style="padding:0 20px 8px">Export</div>
      <div class="card" style="padding:13px;display:grid;gap:10px">
        <div class="muted" style="font-size:12.5px">Saves everything in your Hearth as one file in your Hearth exports folder.</div>
        <button class="btn" ?disabled=${t.busy} @click=${() => void t.exportNow()}>Export now</button>
      </div>

      <div class="label" style="padding:0 20px 8px">Import</div>
      ${aa(t)}

      <div class="label" style="padding:0 20px 8px">Google Contacts</div>
      ${xr(t)}

      <div class="label" style="padding:0 20px 8px">About</div>
      <div class="card" style="padding:13px">Version ${Qr ?? "unknown"}</div>
    </div>`
  };
}
const la = "https://claude.ai/new", ca = "Offline. Showing what was last loaded; changes are paused.";
function da(t, e) {
  switch (e.name) {
    case "home":
      return fs(t);
    case "search":
      return Zr(t);
    case "reachOut":
      return ni(t);
    case "add":
      return is(t);
    case "birthdays":
      return ms(t);
    case "interactions":
      return gs(t);
    case "settings":
      return oa(t);
    case "person":
      return Tt(t, e.id, e.sheet);
    case "personEdit":
      return zr(t, e.id);
    case "relationship":
      return Fr(t, e.personId, e.relId);
    case "household":
      return or(t, e.id);
    case "householdNew":
      return Zs(t);
    case "householdEdit":
      return ar(t, e.id);
    case "group":
      return lr(t, e.id);
    case "groupNew":
      return Ks(t);
    case "groupEdit":
      return Js(t, e.id);
    case "interaction":
      return Hn(t, e.id, e.sheet);
    case "reminder":
    case "reminderNew":
    case "interactionReminderNew":
      return Vr(t, e);
  }
}
const rn = [
  { tab: "home", href: f.home(), icon: w.home, label: "Home" },
  { tab: "search", href: f.search(), icon: w.search, label: "Search" },
  { tab: "reachOut", href: f.reachOut(), icon: w.bell, label: "Reach out" },
  { tab: "add", href: f.add(), icon: w.plusCircle, label: "Add" }
];
function ha(t) {
  const e = (n) => l`<a href=${n.href} class=${t === n.tab ? "active" : ""} aria-label=${n.label} title=${n.label}
      aria-current=${t === n.tab ? "page" : "false"}>${n.icon}</a>`;
  return l`<nav class="tabbar">
    ${rn.slice(0, 2).map(e)}
    <a href=${la} target="_blank" rel="noopener noreferrer" aria-label="Talk to Claude" title="Talk to Claude">${w.mic}</a>
    ${rn.slice(2).map(e)}
  </nav>`;
}
function ii() {
  return l`<button class="icon-btn" aria-label="Menu" title="Menu" @click=${(e) => e.currentTarget.dispatchEvent(new Event("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>${w.menu}</button>`;
}
function si(t) {
  return t ? l`<div class="toast" role="status">${t}</div>` : h;
}
function ua(t, e) {
  const n = e.narrow || t.back || t.title || t.actions.length;
  return l`<div class="shell">
    ${n ? l`<header class="topbar">
          ${e.narrow ? ii() : h}
          ${t.back ? l`<button class="icon-btn" aria-label="Back" title="Back" @click=${() => z(f.home())}>
                ${w.back}
              </button>` : h}
          <span class="title">${t.title ?? ""}</span>
          ${t.actions.map(Qi)}
          <button class="icon-btn muted" aria-label="Refresh" title="Refresh" ?disabled=${e.refreshing} @click=${e.onRefresh}>
            ${w.refresh}
          </button>
        </header>` : h}
    <main class="content" id="content">
      ${e.store.offline ? l`<div class="notice" role="status">${ca}</div>` : h} ${t.body}
    </main>
    ${ha(e.lastTab)} ${t.overlay ?? h} ${si(e.toast)}
  </div>`;
}
function K(t, e) {
  return l`<div class="shell">
    ${e.narrow ? l`<header class="topbar">${ii()}<span class="title">Hearth</span></header>` : h}
    <main class="content status">${t}</main>
    ${si(e.toast)}
  </div>`;
}
const an = (t) => t.length > 1 ? t.replace(/\/+$/, "") : t;
function pa(t, e) {
  const n = an(t), i = an(e);
  return n === i || n.startsWith(`${i}/`);
}
class fa {
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
    const r = i();
    return this.entries.set(e, { path: n, value: r, base: { ...r } }), r;
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
    for (const [n, i] of this.entries) pa(e, i.path) || this.entries.delete(n);
  }
}
const ma = {
  person: ["address", "school"],
  household: ["address"]
}, ri = (t, e) => ma[t]?.includes(e) ?? !1;
function ai(t, e) {
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
function Ke(t, e, n) {
  return ai(t, e).find((i) => i.id === n);
}
function ga(t, e) {
  return ["person", "household", "contact_group", "relationship", "interaction", "reminder"].some((i) => ai(t, i).some((s) => s.id === e));
}
const ht = (t, e) => t === e || typeof t == "object" && typeof e == "object" && JSON.stringify(t) === JSON.stringify(e);
function ut(t, e, n) {
  if (typeof n != "string") return n;
  const i = n.trim();
  return ri(t, e) ? i ? { formatted: i } : null : i || null;
}
function Ye(t, e) {
  return e ? Object.fromEntries(Object.entries(t).filter(([n, i]) => !(n in e) || !ht(i, e[n]))) : t;
}
function We(t, e, n) {
  const i = {};
  for (const [s, r] of Object.entries(n)) {
    if (r === void 0) continue;
    const a = e[s] ?? null;
    if (ri(t, s) && typeof r == "string") {
      const c = (a?.formatted ?? "").trim();
      r.trim() !== c && (i[s] = ut(t, s, r));
      continue;
    }
    if (ht(r, a)) continue;
    const o = ut(t, s, r);
    ht(o, a) || (i[s] = o);
  }
  return i;
}
function on(t, e) {
  const n = {};
  for (const [i, s] of Object.entries(e)) {
    const r = ut(t, i, s);
    r != null && (n[i] = r);
  }
  return n;
}
const oi = "You're offline. Changes are paused.", Je = "Still saving…", pt = "That was already deleted.", ln = "hearth_crm:snapshot:";
function cn(t) {
  return t.reminders && t.reminder_units ? t : { ...t, reminders: t.reminders ?? [], reminder_units: t.reminder_units ?? [] };
}
const va = 250, ya = 3500, dn = [2e3, 5e3, 1e4], ba = 1e4;
class $a {
  constructor(e, n, i, s, r) {
    this.api = e, this.conn = n, this.userId = i, this.storage = s, this.onChange = r, this.phase = { kind: "loading" }, this.snapshot = null, this.entryId = null, this.offline = !1, this.lastError = null, this.createError = null, this.creating = !1, this.retrying = !1, this.search = { text: "", chip: "people" }, this.drafts = new fa(() => this.onChange()), this.busy = !1, this.shrinkingPhoto = !1, this.importState = { kind: "idle" }, this.google = { status: null, loadError: null, preview: null, lastSync: null, working: null }, this.notifications = { status: null, loadError: null, testing: !1 }, this.toast = null, this.writeError = null, this.subscription = null, this.connEpoch = 0, this.timer = null, this.retryTimer = null, this.retryAttempt = 0, this.generation = 0, this.stopped = !1, this.startRun = null, this.retryRun = null, this.toastTimer = null, this.fetchSeq = 0, this.arriving = null, this.pendingMembers = /* @__PURE__ */ new Map(), this.arrivingTimer = null, this.pendingFavorites = /* @__PURE__ */ new Map(), this.onSettings = !1, this.onDisconnected = () => {
      this.connEpoch++, this.subscription = null, this.offline = !0, this.onChange();
    }, this.onReady = () => {
      this.connEpoch++, this.retryAttempt = 0, this.load();
    }, this.onVisibilityChange = () => {
      document.visibilityState !== "visible" || this.offline || !this.snapshot || _a(/* @__PURE__ */ new Date()) !== this.snapshot.today && this.refresh();
    };
  }
  get cacheKey() {
    return `${ln}${this.userId}`;
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
        this.createError = D(e);
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
    }, ya);
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
      this.pendingFavorites.delete(e.id), this.patchFavorite(e.id, e.favorite), this.showToast(we(i));
    }
  }
  async addInteraction(e) {
    return await this.createInteraction(e) !== null;
  }
  /** Saves a new interaction and resolves to its id (null if it failed), for a reminder linked to it. */
  async createInteraction(e) {
    const { person_ids: n, type: i, date: s, summary: r, notes: a } = e, o = await this.write(() => this.api.create("interaction", { person_ids: n, type: i, date: s, summary: r, notes: a }));
    return o ? o.value.id : null;
  }
  /**
   * Changes the interaction's own fields only, so the people on a shared one are kept. Only the
   * fields that differ from `base` (what the sheet opened with) and from the snapshot are sent, so
   * an imported summary over the edit limit doesn't block changing just the date. One deleted
   * elsewhere counts as done (with the deleted toast), so its sheet closes.
   */
  async updateInteraction(e, n, i) {
    const { type: s, date: r, summary: a, notes: o } = n, c = Ye({ type: s, date: r, summary: a, notes: o }, i ? { ...i } : void 0), d = this.snapshot ? Ke(this.snapshot, "interaction", e) : void 0, u = d ? We("interaction", d, c) : c;
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
    const n = { ...on("reminder", { ...e }), due_at: e.due_at ?? null }, i = await this.write(() => this.api.create("reminder", n));
    return i ? (this.markArriving(i.value.id), i.value.id) : null;
  }
  /** Only the fields that differ from `base` and the snapshot are sent. See `updateInteraction`. */
  async updateReminder(e, n, i) {
    const s = Ye({ ...n }, i ? { ...i } : void 0), r = this.snapshot ? Ke(this.snapshot, "reminder", e) : void 0, a = r ? We("reminder", r, s) : s;
    if (!Object.keys(a).length) return !0;
    const o = () => this.api.update("reminder", e, a);
    return await this.write(o, { ifGone: () => {
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
      const c = await this.write(() => this.api.create(e, on(e, i)));
      return c ? (this.markArriving(c.value.id), { id: c.value.id }) : null;
    }
    const r = this.snapshot ? Ke(this.snapshot, e, n) : void 0;
    if (!r)
      return this.refuseOffline() || this.showToast(pt), null;
    const a = We(e, r, Ye(i, s));
    return Object.keys(a).length ? (await this.write(async () => (await this.api.update(e, n, a), !0), { ifGone: () => !1 }))?.value ? { id: n } : null : { id: n };
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
    const i = (s, r) => s.length === r.length && s.every((a) => r.includes(a));
    for (const [s, r] of this.pendingMembers) {
      const a = e.groups.find((o) => o.id === s);
      (n > r.afterSeq || !a || i(a.member_ids, r.ids)) && this.pendingMembers.delete(s);
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
    }, ba), this.onChange();
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
      return this.showToast(Je), !1;
    this.busy = !0, this.importState = { kind: "uploading" }, this.onChange();
    try {
      const i = await this.api.importBundle(e, n);
      return this.importState = { kind: "done", summary: i.summary }, !0;
    } catch (i) {
      const s = i instanceof A ? i : null, r = s?.code ?? "unknown_error";
      return r === "local_changes" || r === "cutover_confirmed" || r === "invalid" || r === "too_large" || r === "bad_request" || r === "no_crm" ? this.importState = { kind: "refused", reason: r, message: s?.message ?? r, problems: s?.problems ?? [], file: e } : (this.importState = { kind: "idle" }, this.showToast(we(i, "Couldn't import"))), !1;
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
      n instanceof A && n.code === "offline" ? this.offline = !0 : this.notifications = { ...this.notifications, loadError: D(n) };
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
      n instanceof A && n.code === "offline" ? this.offline = !0 : this.google = { ...this.google, loadError: D(n) };
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
      return this.showToast(Je), !1;
    this.google = { ...this.google, working: e }, this.onChange();
    const s = this.generation;
    let r = null;
    try {
      r = await n();
    } catch (a) {
      if (s !== this.generation) return !1;
      this.showToast(we(a, i));
    }
    return s !== this.generation || (this.google = e === "preview" ? { ...this.google, working: null, preview: r ?? this.google.preview } : { ...this.google, working: null, lastSync: r ?? this.google.lastSync, preview: r ? null : this.google.preview }, this.onChange(), await this.loadGoogle()), r !== null;
  }
  /** Forgets a person's Google link so the next run creates a new contact. */
  async clearGoogleContact(e) {
    return await this.write(() => this.api.googleClearContact(e), { ifGone: () => {
    } }) ? (await this.loadGoogle(), !0) : !1;
  }
  refuseOffline() {
    return this.offline ? (this.showToast(oi), !0) : !1;
  }
  /** Runs one write at a time. Resolves to null, with a toast, when refused or failed. */
  async write(e, n = {}) {
    if (this.refuseOffline()) return null;
    if (this.busy)
      return this.showToast(Je), null;
    this.busy = !0, this.writeError = null, this.onChange();
    try {
      return { value: await e() };
    } catch (i) {
      const s = i instanceof A ? i : null;
      return n.ifGone && s?.code === "not_found" ? (this.showToast(pt), await this.refresh(), { value: n.ifGone() }) : (this.writeError = s, this.showToast(we(i, n.failure)), null);
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
        this.lastError = i ?? new A("unknown_error", D(n)), this.showToast(`Couldn't refresh: ${this.lastError.message}`);
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
      const i = this.connEpoch, s = await this.api.subscribe((o) => this.onNotice(o));
      if (e !== this.generation) {
        i === this.connEpoch && s().catch(() => {
        });
        return;
      }
      this.subscription = { unsubscribe: s, epoch: i };
      const r = ++this.fetchSeq, a = await this.api.snapshot();
      if (e !== this.generation) return;
      this.accept(a, r), this.phase = { kind: "ready" }, this.retryAttempt = 0, this.onChange(), this.onSettings && (this.loadGoogle(), this.loadNotifications());
    } catch (n) {
      if (e !== this.generation) return;
      this.fail(n);
    }
  }
  show(e) {
    this.phase = e, this.snapshot = null, this.offline = !1, this.onChange();
  }
  fail(e) {
    this.snapshot || (this.snapshot = this.readCache()), this.snapshot ? (this.offline = !0, this.phase = { kind: "ready" }, this.scheduleRetry()) : this.phase = { kind: "error", message: D(e) }, this.onChange();
  }
  keepAndRetry() {
    this.offline = !0, this.phase = { kind: "ready" }, this.scheduleRetry(), this.onChange();
  }
  scheduleRetry() {
    if (this.stopped) return;
    this.clearRetry();
    const e = dn[Math.min(this.retryAttempt, dn.length - 1)];
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
    i && (n > i.afterSeq || ga(e, i.id)) && this.stopArriving();
    const s = this.pendingFavorites.size ? {
      ...e,
      people: e.people.map(
        (r) => this.pendingFavorites.has(r.id) ? { ...r, favorite: this.pendingFavorites.get(r.id) } : r
      )
    } : e;
    this.settlePendingMembers(e, n), this.snapshot = this.withPendingMembers(cn(s)), this.offline = !1, this.lastError = null;
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
        s?.startsWith(ln) && s !== this.cacheKey && n.push(s);
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
      return Array.isArray(n?.people) ? cn(n) : null;
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
    }, va));
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
function _a(t) {
  const e = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${e(t.getMonth() + 1)}-${e(t.getDate())}`;
}
function we(t, e = "Couldn't save") {
  switch (t instanceof A ? t.code : null) {
    case "offline":
      return oi;
    case "backup_in_progress":
      return "Home Assistant is making a backup. Try again in a moment.";
    case "invalid":
      return D(t);
    case "not_found":
      return pt;
    case "import_failed":
    case "cutover_not_confirmed":
    case "sync_refused":
    case "sync_failed":
    case "not_blocked":
    case "no_phone":
      return D(t);
    default:
      return `${e}: ${D(t)}`;
  }
}
function D(t) {
  return t instanceof Error ? t.message : String(t);
}
const wa = ':host{--bg: var(--primary-background-color, #fafafa);--surface: var(--card-background-color, var(--ha-card-background, #ffffff));--text: var(--primary-text-color, #212121);--text-2: var(--secondary-text-color, #727272);--border: var(--divider-color, rgba(0, 0, 0, .12));--accent: var(--primary-color, #03a9f4);--on-accent: var(--text-primary-color, #ffffff);--accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);--hover: color-mix(in srgb, var(--text) 6%, transparent);--thread: var(--divider-color, rgba(0, 0, 0, .12));--danger: var(--error-color, #db4437);--warning: var(--warning-color, #ffa600);--scrim: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, .32));--sans: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif));--serif: var(--sans);--mono: var(--ha-font-family-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace);--tabbar: 56px;position:relative;display:flex;flex-direction:column;height:100dvh;box-sizing:border-box;padding:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) var(--safe-area-content-inset-right, var(--safe-area-inset-right, env(safe-area-inset-right, 0px))) 0 var(--safe-area-content-inset-left, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));background:var(--bg);color:var(--text);font:14px/1.4 var(--sans);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}*{box-sizing:border-box}button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}a{color:inherit;text-decoration:none}input,textarea{font:inherit;color:var(--text)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.shell{display:flex;flex-direction:column;flex:1;min-height:0}.topbar{display:flex;align-items:center;gap:4px;min-height:48px;padding:0 8px;border-bottom:1px solid var(--border);background:var(--bg);flex:none}.topbar .title{flex:1;font:600 16px var(--serif);padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.icon-btn{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border-radius:10px;color:var(--text)}.icon-btn:hover{background:var(--hover)}.icon-btn.accent{color:var(--accent)}.icon-btn.muted{color:var(--text-2)}.icon-btn[disabled]{opacity:.4;cursor:default}.icon-btn svg{width:20px;height:20px}.content{flex:1;overflow-y:auto;overscroll-behavior:contain;padding-bottom:24px;position:relative}.content.status{padding-bottom:calc(24px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.page{max-width:640px;margin:0 auto}.tabbar{flex:none;display:flex;height:calc(var(--tabbar) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));padding-bottom:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));border-top:1px solid var(--border);background:var(--bg)}.tabbar a,.tabbar button{flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-2)}.tabbar .active{color:var(--accent)}.tabbar svg{width:22px;height:22px}.h-serif{font-family:var(--serif);font-weight:600}.mono{font-family:var(--mono)}.label{font:500 10.5px var(--mono);color:var(--text-2);letter-spacing:.02em;text-transform:uppercase}.muted{color:var(--text-2)}.accent{color:var(--accent)}.danger{color:var(--danger)}.warning{color:var(--warning)}.section{margin:16px 0 0}.section-head{display:flex;align-items:baseline;justify-content:space-between;padding:0 16px 6px}.section-head h2{margin:0;font:600 17px var(--serif)}.section-head a,.section-head button{font:600 12px var(--sans);color:var(--accent)}.list{background:var(--surface)}.row{display:flex;align-items:center;gap:12px;padding:8px 16px;min-height:56px;border-bottom:1px solid var(--border);width:100%;text-align:left}.row:last-child{border-bottom:0}.row:hover{background:var(--hover)}.row .main{flex:1;min-width:0}.row .name{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .sub{font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .meta{font:500 10.5px var(--mono);color:var(--text-2);flex:none}.row .star{color:var(--accent);display:inline-block;width:10px;height:10px;margin-left:6px;vertical-align:1px}svg{display:block;width:100%;height:100%}.list-label{padding:10px 16px 4px}.empty{padding:24px 16px;color:var(--text-2);text-align:center}.avatar{flex:none;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-family:var(--serif);font-weight:600;position:relative}.avatar img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}.avatar img.broken{display:none}.stack{display:inline-flex;flex:none}.stack .avatar{box-shadow:0 0 0 2px var(--surface)}.card{background:var(--surface);border-radius:14px;margin:0 16px 18px;padding:10px 13px}.reach-card{margin:16px;padding:16px;border-radius:16px;background:var(--surface);border:1px solid var(--border)}.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--thread);border-radius:999px;font-size:10.5px;color:var(--accent)}.chips{display:flex;flex-wrap:wrap;gap:6px}.pills{display:flex;gap:7px;overflow-x:auto;padding:4px 0}.pill{flex:none;min-height:36px;padding:6px 14px;border-radius:999px;background:var(--surface);color:var(--text-2);font:500 11.5px var(--sans)}.pill.on{background:var(--accent);color:var(--on-accent)}.pill.mono{font:500 11px var(--mono)}.pill.mono.on{background:var(--text);color:var(--bg)}.form{padding:8px 16px;display:grid;gap:16px}.field{display:grid;gap:6px}.field>span{font:500 10.5px var(--mono);color:var(--text-2);text-transform:uppercase}.input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 12px;font-size:15px}.input:focus{border-color:var(--accent);outline:none}textarea.input{min-height:110px;resize:vertical}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px;accent-color:var(--accent)}.btn{min-height:44px;padding:0 18px;border-radius:12px;background:var(--accent);color:var(--on-accent);font-weight:600}.btn[disabled]{opacity:.4;cursor:default}.btn.danger{background:var(--danger);color:var(--on-accent)}.btn.secondary{background:var(--surface);color:var(--text);border:1px solid var(--thread)}.highlight .input{border-color:var(--warning);box-shadow:0 0 0 1px var(--warning)}.field-error{color:var(--danger);font-size:12px}.input[aria-invalid=true]{border-color:var(--danger)}select.input{appearance:auto}.chip-remove{margin-left:2px;min-width:24px;min-height:24px;color:var(--text-2);font-size:14px}.person-picker .chip{color:var(--text)}.photo-picker{display:grid;justify-items:center;gap:10px;padding:8px 0}.photo-picker .actions{display:flex;gap:8px}.file-btn{display:inline-flex;align-items:center;cursor:pointer;position:relative}.file-btn[aria-disabled=true]{opacity:.4;cursor:default}.file-btn:focus-within{outline:2px solid var(--accent);outline-offset:2px}.photo-tap{border-radius:50%}.file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.banner{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--danger);color:var(--on-accent);font:500 11px var(--mono)}.notice{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--accent-soft);color:var(--text);font:500 11px var(--mono)}.center{min-height:60vh;display:grid;place-items:center;text-align:center;padding:24px}.spinner{width:22px;height:22px;border:2px solid var(--thread);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px}@keyframes spin{to{transform:rotate(360deg)}}.sheet-backdrop{position:absolute;inset:0;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10}.sheet{background:var(--bg);width:100%;max-width:640px;max-height:100%;border-radius:16px;display:flex;flex-direction:column;overflow:hidden}.sheet .sheet-body{overflow-y:auto;padding-bottom:calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.dialog{background:var(--surface);border-radius:16px;padding:20px;margin:auto 16px;max-width:360px;width:100%;display:grid;gap:14px;text-align:center}.dialog .actions{display:flex;gap:8px;justify-content:center}.toast{position:absolute;left:50%;transform:translate(-50%);bottom:calc(var(--tabbar) + 16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));background:var(--surface);color:var(--text);border:1px solid var(--border);padding:10px 16px;border-radius:12px;z-index:20;font-size:13px;box-shadow:0 2px 8px var(--scrim)}.actions-row{display:flex;gap:8px;padding:0 20px 18px}.action{width:54px;height:38px;border-radius:12px;background:var(--surface);color:var(--text);display:inline-flex;align-items:center;justify-content:center}.action svg{width:17px;height:17px}.action.primary{background:var(--accent);color:var(--on-accent)}';
function hn() {
  return l`<div class="center"><div class="spinner" role="progressbar" aria-label="Loading"></div></div>`;
}
function xa(t) {
  return l`<div class="center">
    <div style="max-width:420px">
      <div class="h-serif" style="font-size:21px;margin-bottom:12px">Start your Hearth</div>
      <p class="muted">Your Hearth is private to you: other people on this Home Assistant get their own.</p>
      <button class="btn" ?disabled=${t.creating} aria-busy=${t.creating ? "true" : "false"} @click=${() => void t.createCrm()}>
        ${t.creating ? "Creating…" : "Create my Hearth"}
      </button>
      ${t.createError ? l`<p class="danger" role="alert">${t.createError}</p>` : h}
    </div>
  </div>`;
}
function ka(t) {
  return l`<div class="center">
    <div style="max-width:420px">
      <p>Your Hearth didn't load. Check Settings → Devices &amp; services → Hearth.</p>
      ${li(t)}
    </div>
  </div>`;
}
function li(t) {
  return l`<button class="btn" ?disabled=${t.retrying} aria-busy=${t.retrying ? "true" : "false"} @click=${() => void t.retry()}>
    ${t.retrying ? "Retrying…" : "Retry"}
  </button>`;
}
function Ca(t, e) {
  return l`<div class="center">
    <div style="max-width:420px">
      <p>${e}</p>
      ${li(t)}
    </div>
  </div>`;
}
function Ea(t) {
  const e = t instanceof Error ? `${t.name}: ${t.message}` : String(t);
  return l`<div class="center">
    <div style="max-width:460px">
      <div class="h-serif" style="font-size:19px;margin-bottom:12px">Hearth hit a problem</div>
      <pre class="mono danger" style="white-space:pre-wrap;font-size:11px;text-align:left">${e}</pre>
      <button class="btn" @click=${() => location.reload()}>Reload</button>
    </div>
  </div>`;
}
var Sa = Object.defineProperty, fe = (t, e, n, i) => {
  for (var s = void 0, r = t.length - 1, a; r >= 0; r--)
    (a = t[r]) && (s = a(e, n, s) || s);
  return s && Sa(e, n, s), s;
};
function Aa(t, e) {
  return t?.user?.id !== e?.user?.id || t?.connection !== e?.connection;
}
function Ta(t, e) {
  return t?.path !== e?.path || t?.prefix !== e?.prefix;
}
function Ra() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
class ee extends se {
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
      !i || !zi(i) || (e.preventDefault(), i !== `${location.pathname}${location.search}` && U(i));
    };
  }
  static {
    this.styles = pn(wa);
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
    return Li(this.route?.path ?? "");
  }
  willUpdate(e) {
    if (this.syncStore(), e.has("route")) {
      const n = e.get("route"), i = this.renderRoot.querySelector("#content");
      n && i && this.scrollPositions.set(n.path, i.scrollTop), this.lastTab = Gi(this.currentRoute) ?? this.lastTab, this.store?.routeChanged(`${_}${this.route?.path ?? ""}`);
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
    const n = new $a(
      new Di(this.hass.connection, () => this.hass?.auth),
      this.hass.connection,
      e,
      Ra(),
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
    if (!e) return K(hn(), n);
    try {
      const i = e.phase;
      switch (i.kind) {
        case "loading":
          return K(hn(), n);
        case "noCrm":
          return K(xa(e), n);
        case "notLoaded":
          return K(ka(e), n);
        case "error":
          return K(Ca(e, i.message), n);
        case "ready": {
          const s = { ...n, store: e, lastTab: this.lastTab, refreshing: this.refreshing, onRefresh: this.onRefresh };
          return ua(da(e, this.currentRoute), s);
        }
      }
    } catch (i) {
      return console.error(i), K(Ea(i), n);
    }
  }
}
fe([
  he({ attribute: !1, hasChanged: Aa })
], ee.prototype, "hass");
fe([
  he({ type: Boolean })
], ee.prototype, "narrow");
fe([
  he({ attribute: !1, hasChanged: Ta })
], ee.prototype, "route");
fe([
  he({ attribute: !1 })
], ee.prototype, "panel");
fe([
  Ii()
], ee.prototype, "refreshing");
customElements.get("hearth-panel") || customElements.define("hearth-panel", ee);
export {
  ee as HearthPanel,
  Qr as PANEL_VERSION,
  Aa as hassChanged
};
