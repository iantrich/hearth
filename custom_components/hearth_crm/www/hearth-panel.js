/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const _e = globalThis, st = _e.ShadowRoot && (_e.ShadyCSS === void 0 || _e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Xt = Symbol(), $t = /* @__PURE__ */ new WeakMap();
let Vn = class {
  constructor(e, n, s) {
    if (this._$cssResult$ = !0, s !== Xt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = n;
  }
  get styleSheet() {
    let e = this.o;
    const n = this.t;
    if (st && e === void 0) {
      const s = n !== void 0 && n.length === 1;
      s && (e = $t.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), s && $t.set(n, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const Qt = (t) => new Vn(typeof t == "string" ? t : t + "", void 0, Xt), qn = (t, e) => {
  if (st) t.adoptedStyleSheets = e.map((n) => n instanceof CSSStyleSheet ? n : n.styleSheet);
  else for (const n of e) {
    const s = document.createElement("style"), i = _e.litNonce;
    i !== void 0 && s.setAttribute("nonce", i), s.textContent = n.cssText, t.appendChild(s);
  }
}, _t = st ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((e) => {
  let n = "";
  for (const s of e.cssRules) n += s.cssText;
  return Qt(n);
})(t) : t;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Kn, defineProperty: Yn, getOwnPropertyDescriptor: Wn, getOwnPropertyNames: Zn, getOwnPropertySymbols: Jn, getPrototypeOf: Xn } = Object, Te = globalThis, xt = Te.trustedTypes, Qn = xt ? xt.emptyScript : "", es = Te.reactiveElementPolyfillSupport, te = (t, e) => t, Ce = { toAttribute(t, e) {
  switch (e) {
    case Boolean:
      t = t ? Qn : null;
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
} }, it = (t, e) => !Kn(t, e), wt = { attribute: !0, type: String, converter: Ce, reflect: !1, useDefault: !1, hasChanged: it };
Symbol.metadata ??= Symbol("metadata"), Te.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let K = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ??= []).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, n = wt) {
    if (n.state && (n.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((n = Object.create(n)).wrapped = !0), this.elementProperties.set(e, n), !n.noAccessor) {
      const s = Symbol(), i = this.getPropertyDescriptor(e, s, n);
      i !== void 0 && Yn(this.prototype, e, i);
    }
  }
  static getPropertyDescriptor(e, n, s) {
    const { get: i, set: r } = Wn(this.prototype, e) ?? { get() {
      return this[n];
    }, set(a) {
      this[n] = a;
    } };
    return { get: i, set(a) {
      const l = i?.call(this);
      r?.call(this, a), this.requestUpdate(e, l, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? wt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(te("elementProperties"))) return;
    const e = Xn(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(te("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(te("properties"))) {
      const n = this.properties, s = [...Zn(n), ...Jn(n)];
      for (const i of s) this.createProperty(i, n[i]);
    }
    const e = this[Symbol.metadata];
    if (e !== null) {
      const n = litPropertyMetadata.get(e);
      if (n !== void 0) for (const [s, i] of n) this.elementProperties.set(s, i);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [n, s] of this.elementProperties) {
      const i = this._$Eu(n, s);
      i !== void 0 && this._$Eh.set(i, n);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    const n = [];
    if (Array.isArray(e)) {
      const s = new Set(e.flat(1 / 0).reverse());
      for (const i of s) n.unshift(_t(i));
    } else e !== void 0 && n.push(_t(e));
    return n;
  }
  static _$Eu(e, n) {
    const s = n.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof e == "string" ? e.toLowerCase() : void 0;
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
    for (const s of n.keys()) this.hasOwnProperty(s) && (e.set(s, this[s]), delete this[s]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    const e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return qn(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((e) => e.hostDisconnected?.());
  }
  attributeChangedCallback(e, n, s) {
    this._$AK(e, s);
  }
  _$ET(e, n) {
    const s = this.constructor.elementProperties.get(e), i = this.constructor._$Eu(e, s);
    if (i !== void 0 && s.reflect === !0) {
      const r = (s.converter?.toAttribute !== void 0 ? s.converter : Ce).toAttribute(n, s.type);
      this._$Em = e, r == null ? this.removeAttribute(i) : this.setAttribute(i, r), this._$Em = null;
    }
  }
  _$AK(e, n) {
    const s = this.constructor, i = s._$Eh.get(e);
    if (i !== void 0 && this._$Em !== i) {
      const r = s.getPropertyOptions(i), a = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : Ce;
      this._$Em = i;
      const l = a.fromAttribute(n, r.type);
      this[i] = l ?? this._$Ej?.get(i) ?? l, this._$Em = null;
    }
  }
  requestUpdate(e, n, s, i = !1, r) {
    if (e !== void 0) {
      const a = this.constructor;
      if (i === !1 && (r = this[e]), s ??= a.getPropertyOptions(e), !((s.hasChanged ?? it)(r, n) || s.useDefault && s.reflect && r === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, s)))) return;
      this.C(e, n, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, n, { useDefault: s, reflect: i, wrapped: r }, a) {
    s && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? n ?? this[e]), r !== !0 || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || s || (n = void 0), this._$AL.set(e, n)), i === !0 && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
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
        for (const [i, r] of this._$Ep) this[i] = r;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [i, r] of s) {
        const { wrapped: a } = r, l = this[i];
        a !== !0 || this._$AL.has(i) || l === void 0 || this.C(i, void 0, r, l);
      }
    }
    let e = !1;
    const n = this._$AL;
    try {
      e = this.shouldUpdate(n), e ? (this.willUpdate(n), this._$EO?.forEach((s) => s.hostUpdate?.()), this.update(n)) : this._$EM();
    } catch (s) {
      throw e = !1, this._$EM(), s;
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
K.elementStyles = [], K.shadowRootOptions = { mode: "open" }, K[te("elementProperties")] = /* @__PURE__ */ new Map(), K[te("finalized")] = /* @__PURE__ */ new Map(), es?.({ ReactiveElement: K }), (Te.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const rt = globalThis, kt = (t) => t, Ee = rt.trustedTypes, Ct = Ee ? Ee.createPolicy("lit-html", { createHTML: (t) => t }) : void 0, en = "$lit$", H = `lit$${Math.random().toFixed(9).slice(2)}$`, tn = "?" + H, ts = `<${tn}>`, G = document, ie = () => G.createComment(""), re = (t) => t === null || typeof t != "object" && typeof t != "function", at = Array.isArray, ns = (t) => at(t) || typeof t?.[Symbol.iterator] == "function", Ue = `[ 	
\f\r]`, Q = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Et = /-->/g, At = />/g, U = RegExp(`>|${Ue}(?:([^\\s"'>=/]+)(${Ue}*=${Ue}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), St = /'/g, Tt = /"/g, nn = /^(?:script|style|textarea|title)$/i, sn = (t) => (e, ...n) => ({ _$litType$: t, strings: e, values: n }), o = sn(1), x = sn(2), P = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), Rt = /* @__PURE__ */ new WeakMap(), D = G.createTreeWalker(G, 129);
function rn(t, e) {
  if (!at(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Ct !== void 0 ? Ct.createHTML(e) : e;
}
const ss = (t, e) => {
  const n = t.length - 1, s = [];
  let i, r = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", a = Q;
  for (let l = 0; l < n; l++) {
    const c = t[l];
    let h, u, f = -1, m = 0;
    for (; m < c.length && (a.lastIndex = m, u = a.exec(c), u !== null); ) m = a.lastIndex, a === Q ? u[1] === "!--" ? a = Et : u[1] !== void 0 ? a = At : u[2] !== void 0 ? (nn.test(u[2]) && (i = RegExp("</" + u[2], "g")), a = U) : u[3] !== void 0 && (a = U) : a === U ? u[0] === ">" ? (a = i ?? Q, f = -1) : u[1] === void 0 ? f = -2 : (f = a.lastIndex - u[2].length, h = u[1], a = u[3] === void 0 ? U : u[3] === '"' ? Tt : St) : a === Tt || a === St ? a = U : a === Et || a === At ? a = Q : (a = U, i = void 0);
    const g = a === U && t[l + 1].startsWith("/>") ? " " : "";
    r += a === Q ? c + ts : f >= 0 ? (s.push(h), c.slice(0, f) + en + c.slice(f) + H + g) : c + H + (f === -2 ? l : g);
  }
  return [rn(t, r + (t[n] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), s];
};
class ae {
  constructor({ strings: e, _$litType$: n }, s) {
    let i;
    this.parts = [];
    let r = 0, a = 0;
    const l = e.length - 1, c = this.parts, [h, u] = ss(e, n);
    if (this.el = ae.createElement(h, s), D.currentNode = this.el.content, n === 2 || n === 3) {
      const f = this.el.content.firstChild;
      f.replaceWith(...f.childNodes);
    }
    for (; (i = D.nextNode()) !== null && c.length < l; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const f of i.getAttributeNames()) if (f.endsWith(en)) {
          const m = u[a++], g = i.getAttribute(f).split(H), w = /([.?@])?(.*)/.exec(m);
          c.push({ type: 1, index: r, name: w[2], strings: g, ctor: w[1] === "." ? rs : w[1] === "?" ? as : w[1] === "@" ? os : Re }), i.removeAttribute(f);
        } else f.startsWith(H) && (c.push({ type: 6, index: r }), i.removeAttribute(f));
        if (nn.test(i.tagName)) {
          const f = i.textContent.split(H), m = f.length - 1;
          if (m > 0) {
            i.textContent = Ee ? Ee.emptyScript : "";
            for (let g = 0; g < m; g++) i.append(f[g], ie()), D.nextNode(), c.push({ type: 2, index: ++r });
            i.append(f[m], ie());
          }
        }
      } else if (i.nodeType === 8) if (i.data === tn) c.push({ type: 2, index: r });
      else {
        let f = -1;
        for (; (f = i.data.indexOf(H, f + 1)) !== -1; ) c.push({ type: 7, index: r }), f += H.length - 1;
      }
      r++;
    }
  }
  static createElement(e, n) {
    const s = G.createElement("template");
    return s.innerHTML = e, s;
  }
}
function Y(t, e, n = t, s) {
  if (e === P) return e;
  let i = s !== void 0 ? n._$Co?.[s] : n._$Cl;
  const r = re(e) ? void 0 : e._$litDirective$;
  return i?.constructor !== r && (i?._$AO?.(!1), r === void 0 ? i = void 0 : (i = new r(t), i._$AT(t, n, s)), s !== void 0 ? (n._$Co ??= [])[s] = i : n._$Cl = i), i !== void 0 && (e = Y(t, i._$AS(t, e.values), i, s)), e;
}
class is {
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
    const { el: { content: n }, parts: s } = this._$AD, i = (e?.creationScope ?? G).importNode(n, !0);
    D.currentNode = i;
    let r = D.nextNode(), a = 0, l = 0, c = s[0];
    for (; c !== void 0; ) {
      if (a === c.index) {
        let h;
        c.type === 2 ? h = new le(r, r.nextSibling, this, e) : c.type === 1 ? h = new c.ctor(r, c.name, c.strings, this, e) : c.type === 6 && (h = new ls(r, this, e)), this._$AV.push(h), c = s[++l];
      }
      a !== c?.index && (r = D.nextNode(), a++);
    }
    return D.currentNode = G, i;
  }
  p(e) {
    let n = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(e, s, n), n += s.strings.length - 2) : s._$AI(e[n])), n++;
  }
}
class le {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(e, n, s, i) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = e, this._$AB = n, this._$AM = s, this.options = i, this._$Cv = i?.isConnected ?? !0;
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
    e = Y(this, e, n), re(e) ? e === d || e == null || e === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : e !== this._$AH && e !== P && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : ns(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== d && re(this._$AH) ? this._$AA.nextSibling.data = e : this.T(G.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    const { values: n, _$litType$: s } = e, i = typeof s == "number" ? this._$AC(e) : (s.el === void 0 && (s.el = ae.createElement(rn(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === i) this._$AH.p(n);
    else {
      const r = new is(i, this), a = r.u(this.options);
      r.p(n), this.T(a), this._$AH = r;
    }
  }
  _$AC(e) {
    let n = Rt.get(e.strings);
    return n === void 0 && Rt.set(e.strings, n = new ae(e)), n;
  }
  k(e) {
    at(this._$AH) || (this._$AH = [], this._$AR());
    const n = this._$AH;
    let s, i = 0;
    for (const r of e) i === n.length ? n.push(s = new le(this.O(ie()), this.O(ie()), this, this.options)) : s = n[i], s._$AI(r), i++;
    i < n.length && (this._$AR(s && s._$AB.nextSibling, i), n.length = i);
  }
  _$AR(e = this._$AA.nextSibling, n) {
    for (this._$AP?.(!1, !0, n); e !== this._$AB; ) {
      const s = kt(e).nextSibling;
      kt(e).remove(), e = s;
    }
  }
  setConnected(e) {
    this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
  }
}
class Re {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, n, s, i, r) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = e, this.name = n, this._$AM = i, this.options = r, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = d;
  }
  _$AI(e, n = this, s, i) {
    const r = this.strings;
    let a = !1;
    if (r === void 0) e = Y(this, e, n, 0), a = !re(e) || e !== this._$AH && e !== P, a && (this._$AH = e);
    else {
      const l = e;
      let c, h;
      for (e = r[0], c = 0; c < r.length - 1; c++) h = Y(this, l[s + c], n, c), h === P && (h = this._$AH[c]), a ||= !re(h) || h !== this._$AH[c], h === d ? e = d : e !== d && (e += (h ?? "") + r[c + 1]), this._$AH[c] = h;
    }
    a && !i && this.j(e);
  }
  j(e) {
    e === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}
class rs extends Re {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === d ? void 0 : e;
  }
}
class as extends Re {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== d);
  }
}
class os extends Re {
  constructor(e, n, s, i, r) {
    super(e, n, s, i, r), this.type = 5;
  }
  _$AI(e, n = this) {
    if ((e = Y(this, e, n, 0) ?? d) === P) return;
    const s = this._$AH, i = e === d && s !== d || e.capture !== s.capture || e.once !== s.once || e.passive !== s.passive, r = e !== d && (s === d || i);
    i && this.element.removeEventListener(this.name, this, s), r && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
  }
}
class ls {
  constructor(e, n, s) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = n, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    Y(this, e);
  }
}
const cs = rt.litHtmlPolyfillSupport;
cs?.(ae, le), (rt.litHtmlVersions ??= []).push("3.3.3");
const ds = (t, e, n) => {
  const s = n?.renderBefore ?? e;
  let i = s._$litPart$;
  if (i === void 0) {
    const r = n?.renderBefore ?? null;
    s._$litPart$ = i = new le(e.insertBefore(ie(), r), r, void 0, n ?? {});
  }
  return i._$AI(t), i;
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
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = ds(n, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return P;
  }
};
ne._$litElement$ = !0, ne.finalized = !0, ot.litElementHydrateSupport?.({ LitElement: ne });
const hs = ot.litElementPolyfillSupport;
hs?.({ LitElement: ne });
(ot.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const us = { attribute: !0, type: String, converter: Ce, reflect: !1, hasChanged: it }, ps = (t = us, e, n) => {
  const { kind: s, metadata: i } = n;
  let r = globalThis.litPropertyMetadata.get(i);
  if (r === void 0 && globalThis.litPropertyMetadata.set(i, r = /* @__PURE__ */ new Map()), s === "setter" && ((t = Object.create(t)).wrapped = !0), r.set(n.name, t), s === "accessor") {
    const { name: a } = n;
    return { set(l) {
      const c = e.get.call(this);
      e.set.call(this, l), this.requestUpdate(a, c, t, !0, l);
    }, init(l) {
      return l !== void 0 && this.C(a, void 0, t, l), l;
    } };
  }
  if (s === "setter") {
    const { name: a } = n;
    return function(l) {
      const c = this[a];
      e.call(this, l), this.requestUpdate(a, c, t, !0, l);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function ce(t) {
  return (e, n) => typeof n == "object" ? ps(t, e, n) : ((s, i, r) => {
    const a = i.hasOwnProperty(r);
    return i.constructor.createProperty(r, s), a ? Object.getOwnPropertyDescriptor(i, r) : void 0;
  })(t, e, n);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function fs(t) {
  return ce({ ...t, state: !0, attribute: !1 });
}
function ms(t) {
  return t && typeof t == "object" ? t : null;
}
class A extends Error {
  constructor(e, n, s, i = []) {
    super(n), this.code = e, this.field = s, this.problems = i, this.name = "HearthError";
  }
}
const gs = /^([A-Za-z_][\w.]*): /;
function Mt(t) {
  if (t instanceof A) return t;
  const e = t ?? {}, n = typeof e.message == "string" ? e.message : String(t);
  if (typeof e.code == "string" && e.code) {
    const s = e.code === "invalid" ? gs.exec(n)?.[1] : void 0;
    return new A(e.code, n, s);
  }
  return typeof e.code == "number" ? new A("offline", n) : t instanceof Error ? new A("unknown_error", n) : new A("offline", n);
}
class vs {
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
      return await this.conn.subscribeMessage((n) => e(ms(n)), { type: "hearth_crm/subscribe" }, { resubscribe: !1 });
    } catch (n) {
      throw Mt(n);
    }
  }
  create(e, n) {
    return this.send({ type: "hearth_crm/create", kind: e, fields: n });
  }
  update(e, n, s) {
    return this.send({ type: "hearth_crm/update", kind: e, entity_id: n, changes: s });
  }
  remove(e, n) {
    return this.send({ type: "hearth_crm/delete", kind: e, entity_id: n });
  }
  /** `data` is the photo as base64, with no data: prefix. */
  setPhoto(e, n, s) {
    return this.send({ type: "hearth_crm/photo/set", kind: e, entity_id: n, data: s });
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
    const s = this.auth();
    if (!s) throw new A("unknown_error", "Not signed in to Home Assistant.");
    const i = new FormData();
    i.append("file", e, e.name), i.append("replace_existing", n ? "true" : "false");
    let r;
    try {
      s.expired && await s.refreshAccessToken(), r = await fetch("/api/hearth_crm/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.data.access_token}` },
        body: i
      });
    } catch (l) {
      throw new A("offline", l instanceof Error ? l.message : String(l));
    }
    if (r.ok) return await r.json();
    let a = null;
    try {
      a = await r.json();
    } catch {
    }
    if (typeof a?.reason == "string") {
      const l = Array.isArray(a.problems) ? a.problems.filter((c) => typeof c == "string") : [];
      throw new A(a.reason, typeof a.message == "string" ? a.message : a.reason, void 0, l);
    }
    throw new A("import_failed", "Import failed unexpectedly; see the Home Assistant log.");
  }
}
const _ = "/hearth";
function ys(t) {
  const e = t.split("/").filter(Boolean).map(bs), [n, s, i] = e;
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
      if (s && i === "edit") return { name: "personEdit", id: s };
      if (s && i === "relationship") {
        const r = e[3];
        if (r) return { name: "relationship", personId: s, relId: r === "new" ? null : r };
      }
      if (s) return { name: "person", id: s, sheet: i === "log" ? "log" : null };
      break;
    // Record ids are never "new".
    case "household":
      if (s === "new") return { name: "householdNew" };
      if (s && i === "edit") return { name: "householdEdit", id: s };
      if (s) return { name: "household", id: s };
      break;
    case "group":
      if (s === "new") return { name: "groupNew" };
      if (s && i === "edit") return { name: "groupEdit", id: s };
      if (s) return { name: "group", id: s };
      break;
    case "interaction":
      if (s) return { name: "interaction", id: s, sheet: i === "edit" ? "edit" : null };
      break;
  }
  return { name: "home" };
}
function bs(t) {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}
const T = encodeURIComponent, p = {
  home: () => _,
  search: () => `${_}/search`,
  reachOut: () => `${_}/reach-out`,
  add: () => `${_}/add`,
  birthdays: () => `${_}/birthdays`,
  interactions: () => `${_}/interactions`,
  settings: () => `${_}/settings`,
  person: (t) => `${_}/person/${T(t)}`,
  logInteraction: (t) => `${_}/person/${T(t)}/log`,
  editPerson: (t) => `${_}/person/${T(t)}/edit`,
  newRelationship: (t) => `${_}/person/${T(t)}/relationship/new`,
  relationship: (t, e) => `${_}/person/${T(t)}/relationship/${T(e)}`,
  household: (t) => `${_}/household/${T(t)}`,
  newHousehold: () => `${_}/household/new`,
  editHousehold: (t) => `${_}/household/${T(t)}/edit`,
  group: (t) => `${_}/group/${T(t)}`,
  newGroup: () => `${_}/group/new`,
  editGroup: (t) => `${_}/group/${T(t)}/edit`,
  interaction: (t) => `${_}/interaction/${T(t)}`,
  editInteraction: (t) => `${_}/interaction/${T(t)}/edit`
};
function $s(t) {
  return t === _ || t.startsWith(`${_}/`) || t.startsWith(`${_}?`);
}
function _s(t) {
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
const Fe = "hearthDepth";
function je() {
  const t = history.state?.[Fe];
  return typeof t == "number" ? t : 0;
}
function L(t, e = !1) {
  e ? history.replaceState({ [Fe]: je() }, "", t) : history.pushState({ [Fe]: je() + 1 }, "", t), window.dispatchEvent(new Event("location-changed"));
}
function B(t) {
  je() > 0 ? history.back() : L(t, !0);
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
const V = { ATTRIBUTE: 1, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4 }, an = (t) => (...e) => ({ _$litDirective$: t, values: e });
let on = class {
  constructor(e) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(e, n, s) {
    this._$Ct = e, this._$AM = n, this._$Ci = s;
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
const xs = (t) => t.strings === void 0, ws = {}, ln = (t, e = ws) => t._$AH = e;
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ks = an(class extends on {
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
const Cs = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), Es = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), As = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }), Ae = (t) => Cs.format(lt(t)), Ss = (t) => Es.format(lt(t)), cn = (t) => As.format(lt(t));
function Ts(t, e, n) {
  if (e) return Ae(t);
  const s = `${Ae(t)}, ${t.slice(0, 4)}`;
  return n === null ? s : `${s} - ${n}`;
}
function Rs(t) {
  return t === 0 ? "Today" : `In ${t} ${t === 1 ? "day" : "days"}`;
}
function Ms(t) {
  return t.trim().split(/\s+/).slice(0, 2).map((e) => e.charAt(0)).join("").toUpperCase();
}
function Me(t, e, n = `${e}s`) {
  return `${t} ${t === 1 ? e : n}`;
}
const k = (t) => x`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t}</svg>`, pe = (t) => x`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${t}</svg>`, b = {
  home: k(x`<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>`),
  search: k(x`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`),
  mic: pe(x`<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/>`),
  bell: k(x`<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`),
  plusCircle: k(x`<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>`),
  plus: k(x`<path d="M12 5v14M5 12h14"/>`),
  star: k(x`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  starFill: pe(x`<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`),
  phone: k(x`<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>`),
  message: k(x`<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.6A8.5 8.5 0 1 1 21 12z"/>`),
  envelope: k(x`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`),
  mapPin: k(x`<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`),
  globe: k(x`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>`),
  linkedIn: pe(x`<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/>`),
  facebook: pe(x`<path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2C16.7 2.1 15.7 2 14.6 2 12.2 2 10.6 3.4 10.6 6.1v2.4H8v3.3h2.6V22H14V11.8h2.6l.4-3.3z"/>`),
  instagram: k(x`<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>`),
  pencil: k(x`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`),
  trash: k(x`<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>`),
  back: k(x`<path d="m15 18-6-6 6-6"/>`),
  refresh: k(x`<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>`),
  gear: k(x`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`),
  menu: k(x`<path d="M4 6h16M4 12h16M4 18h16"/>`),
  close: k(x`<path d="M6 6l12 12M18 6 6 18"/>`)
};
function E(t, e, n = 42) {
  const s = Math.round(n * 15 / 42);
  return o`<span class="avatar" style="width:${n}px;height:${n}px;font-size:${s}px">
    ${Ms(t)}
    ${e ? ks(
    e,
    o`<img src=${e} alt="" loading="lazy" @error=${(i) => i.target.classList.add("broken")} />`
  ) : d}
  </span>`;
}
function Ps(t, e = 42, n = 3) {
  const s = t.slice(0, n), i = t.length - s.length, r = Math.round(e / 3);
  return o`<span class="stack" aria-hidden="true">
    ${s.map(
    (a, l) => o`<span style="margin-left:${l === 0 ? 0 : -r}px;z-index:${s.length - l};display:inline-flex"
          >${E(a.name, a.photo_url, e)}</span
        >`
  )}
    ${i > 0 ? o`<span style="margin-left:${-r}px;z-index:${s.length + 1};display:inline-flex"
          ><span class="avatar" style="width:${e}px;height:${e}px;font-size:${Math.round(e * 15 / 42)}px;box-shadow:0 0 0 2px var(--surface)"
            >+${i}</span
          ></span
        >` : d}
  </span>`;
}
function Ve(t, e) {
  const n = t.contact_status, s = e ?? t.how_i_know_them?.trim() ?? "", i = n.days_since_contact === null ? "—" : `${n.days_since_contact}d ago`;
  return o`<a class="row" href=${p.person(t.id)}>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}${t.favorite ? o`<span class="star">${b.starFill}</span>` : d}</div>
      ${s ? o`<div class="sub">${s}</div>` : d}
    </span>
    <span class="meta ${n.urgency === "overdue" ? "danger" : ""}">${i}</span>
  </a>`;
}
function Ns(t) {
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
const Is = (t) => o`<div class="label list-label">${t}</div>`;
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const C = an(class extends on {
  constructor(t) {
    if (super(t), t.type !== V.PROPERTY && t.type !== V.ATTRIBUTE && t.type !== V.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
    if (!xs(t)) throw Error("`live` bindings can only contain a single expression");
  }
  render(t) {
    return t;
  }
  update(t, [e]) {
    if (e === P || e === d) return e;
    const n = t.element, s = t.name;
    if (t.type === V.PROPERTY) {
      if (e === n[s]) return P;
    } else if (t.type === V.BOOLEAN_ATTRIBUTE) {
      if (!!e === n.hasAttribute(s)) return P;
    } else if (t.type === V.ATTRIBUTE && n.getAttribute(s) === e + "") return P;
    return ln(t), e;
  }
}), Hs = () => ({
  name: "",
  phone: "",
  email: "",
  how_i_know_them: "",
  has_birthday: !1,
  birthday: "",
  birth_year_unknown: !1
}), Os = { name: 200, phone: 50, email: 500, how_i_know_them: 2e3 }, De = (t) => t.trim() || null, Nt = "add-person";
function Ls(t) {
  const e = t.drafts.open(Nt, p.add(), Hs), n = (a) => t.drafts.patch(Nt, a), s = e.name.trim() !== "" && (!e.has_birthday || e.birthday !== ""), i = (a, l, c = "text", h = "off") => o`<label class="field">
      <span>${l}</span>
      <input
        id=${`add-${a.replace(/_/g, "-")}`}
        class="input"
        type=${c}
        autocomplete=${h}
        maxlength=${Os[a]}
        .value=${C(e[a])}
        @input=${(u) => n({ [a]: u.target.value })}
      />
    </label>`, r = async () => {
    if (!s) return;
    const a = await t.addPerson({
      name: e.name,
      phone: De(e.phone),
      email: De(e.email),
      how_i_know_them: De(e.how_i_know_them),
      birthday: e.has_birthday ? e.birthday : null,
      birth_year_unknown: e.has_birthday && e.birth_year_unknown
    });
    a && L(p.person(a));
  };
  return {
    title: "Add person",
    back: !1,
    actions: [],
    body: o`<div class="page form">
      ${i("name", "Name")} ${i("phone", "Phone", "tel", "tel")} ${i("email", "Email", "email", "email")}
      ${i("how_i_know_them", "How I know them")}
      <label class="check">
        <input type="checkbox" .checked=${C(e.has_birthday)} @change=${(a) => n({ has_birthday: a.target.checked })} />
        Has a known birthday
      </label>
      ${e.has_birthday ? o`<label class="field">
              <span>Birthday</span>
              <input id="add-birthday" class="input" type="date" .value=${C(e.birthday)}
                @input=${(a) => n({ birthday: a.target.value })} />
            </label>
            <label class="check">
              <input
                type="checkbox"
                .checked=${C(e.birth_year_unknown)}
                @change=${(a) => n({ birth_year_unknown: a.target.checked })}
              />
              Year unknown
            </label>` : d}
      <button class="btn" ?disabled=${!s || t.busy} @click=${r}>Save</button>
    </div>`
  };
}
const Us = new Intl.Collator("en", { numeric: !0, sensitivity: "base" });
function O(t, e) {
  return Us.compare(t, e);
}
function qe(t, e) {
  return O(t.name, e.name);
}
function Pe(t) {
  return t.trim().split(/\s+/)[0] ?? "";
}
function W(t) {
  return t.name_status !== "needs_name" && t.name_status !== "not_a_household" && !!t.name;
}
function I(t) {
  return W(t) ? t.name : t.name_status === "not_a_household" ? "Not a household" : "Needs a name";
}
function ct(t, e) {
  const n = I(t);
  if (W(t)) return n;
  const s = t.member_ids.map((i) => e.find((r) => r.id === i)).filter((i) => !!i).map((i) => Pe(i.name)).filter(Boolean);
  return s.length ? `${n} (${s.join(", ")})` : n;
}
function dn(t, e) {
  return t.filter(
    (n) => !n.hide_from_list && n.days_until_birthday !== null && (e === void 0 || n.days_until_birthday <= e)
  ).sort((n, s) => n.days_until_birthday - s.days_until_birthday || O(n.name, s.name));
}
const Ds = /^(\d{4})-(\d{2})-(\d{2})$/, zs = 864e5;
function Gs(t) {
  const e = Ds.exec(t);
  if (!e) throw new Error(`Not a calendar day: ${t}`);
  return Date.UTC(Number(e[1]), Number(e[2]) - 1, Number(e[3]));
}
function Bs(t, e) {
  return new Date(Gs(t) + e * zs).toISOString().slice(0, 10);
}
const Fs = 6;
function js(t) {
  return t.filter((e) => e.favorite && !e.hide_from_list).slice(0, Fs);
}
function hn(t, e, n) {
  const s = new Set(e.filter((r) => !r.hide_from_list).map((r) => r.id)), { since: i } = n;
  return t.filter((r) => (i === void 0 || r.date >= i) && r.person_ids.some((a) => s.has(a))).sort(un).slice(0, n.limit);
}
function Vs(t, e) {
  return t.filter((n) => n.person_ids.includes(e)).sort(un);
}
function un(t, e) {
  return t.date === e.date ? 0 : t.date > e.date ? -1 : 1;
}
function dt(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const s of e) n.has(s.id) || n.set(s.id, s);
  return t.person_ids.flatMap((s) => {
    const i = n.get(s);
    return i ? [i] : [];
  });
}
function qs(t) {
  const e = (i) => Pe(i.name) || i.name, [n, s] = t;
  return n ? s ? t.length === 2 ? `${e(n)} & ${e(s)}` : `${e(n)} and ${t.length - 1} others` : n.name : "";
}
function $(t) {
  if (!t.snapshot) throw new Error("No snapshot to draw from");
  return t.snapshot;
}
function F(t) {
  return { title: null, back: !0, actions: [], body: o`<div class="empty">This ${t} no longer exists.</div>` };
}
const Ne = {
  title: null,
  back: !0,
  actions: [],
  body: o`<div class="center"><div><div class="spinner"></div></div></div>`
};
function pn(t, e) {
  const n = e.length === 1 ? e[0] : void 0, s = o`${Ps(e)}<span class="name" style="flex:1;min-width:0"
      >${qs(e)}</span
    >`;
  return o`<div class="row" style="flex-direction:column;align-items:stretch;gap:2px">
    <a
      href=${n ? p.person(n.id) : p.interaction(t.id)}
      style="display:flex;align-items:center;gap:12px"
      >${s}</a
    >
    <a href=${p.interaction(t.id)} style="display:flex;gap:12px">
      <span class="sub" style="flex:1">${t.summary}</span>
      <span class="meta">${Ae(t.date)}</span>
    </a>
  </div>`;
}
function Ks(t) {
  return o`<a class="row" href=${p.person(t.id)}>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${Rs(t.days_until_birthday ?? 0)}</div>
    </span>
  </a>`;
}
function Ys(t) {
  const { people: e, interactions: n, today: s } = $(t), i = js(e), r = dn(e, 30).slice(0, 3), a = hn(n, e, { since: Bs(s, -30), limit: 10 });
  return {
    title: "Hearth",
    back: !1,
    actions: [{ icon: b.gear, label: "Settings", href: p.settings() }],
    body: o`<div class="page">
      ${i.length ? o`<div class="list favorites" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 12px;padding:16px">
            ${i.map(
      (l) => o`<a href=${p.person(l.id)} style="display:grid;justify-items:center;gap:6px;min-width:0">
                ${E(l.name, l.photo_url, 56)}
                <span class="fav-name" style="font-weight:600;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >${Pe(l.name)}</span
                >
              </a>`
    )}
          </div>` : d}

      <div class="section">
        <div class="section-head"><h2>Upcoming</h2><a href=${p.birthdays()}>See all</a></div>
        <div class="list">
          ${r.length ? r.map(Ks) : o`<div class="empty">No birthdays in the next 30 days.</div>`}
        </div>
      </div>

      <div class="section">
        <!-- "See more", not "See all": that list caps at 25. -->
        <div class="section-head"><h2>Recent</h2><a href=${p.interactions()}>See more</a></div>
        <div class="list">
          ${a.length ? a.map((l) => pn(l, dt(l, e))) : o`<div class="empty">Nothing logged in the last 30 days.</div>`}
        </div>
      </div>
    </div>`
  };
}
function Ws(t) {
  const e = dn($(t).people);
  return {
    title: "Birthdays",
    back: !0,
    actions: [],
    body: o`<div class="page list">
      ${e.length ? e.map((n) => {
      const s = n.days_until_birthday ?? 0;
      return o`<a class="row" href=${p.person(n.id)}>
              ${E(n.name, n.photo_url)}
              <span class="main"><div class="name">${n.name}</div></span>
              <span class="meta">${s === 0 ? "Today" : `${s}d`}</span>
            </a>`;
    }) : o`<div class="empty">No birthdays yet.</div>`}
    </div>`
  };
}
function Zs(t) {
  const { people: e, interactions: n } = $(t), s = hn(n, e, { limit: 25 });
  return {
    title: "Recent",
    back: !0,
    actions: [],
    body: o`<div class="page list">
      ${s.length ? s.map((i) => pn(i, dt(i, e))) : o`<div class="empty">No interactions yet.</div>`}
    </div>`
  };
}
function N(t) {
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
    set: (n, s) => t.drafts.patch(e, { [n]: s }),
    error: (n) => fn(t.writeError, n)
  };
}
function fn(t, e) {
  const n = t?.field;
  if (!t || !n || n !== e && !n.startsWith(`${e}.`)) return null;
  const s = `${n}: `;
  return t.message.startsWith(s) ? t.message.slice(s.length) : t.message;
}
const Z = (t) => `field-${t.replace(/_/g, "-")}`, he = (t, e) => {
  const n = t.get(e);
  return typeof n == "string" ? n : "";
}, ht = (t) => t.target.value;
function J(t, e) {
  const n = t.error(e);
  return n ? o`<div class="field-error" role="alert" data-error-for=${e}>${n}</div>` : d;
}
function R(t, e, n, s = {}) {
  return o`<label class="field">
    <span>${n}</span>
    <input
      id=${Z(e)}
      name=${e}
      class="input"
      type=${s.type ?? "text"}
      autocomplete=${s.autocomplete ?? "off"}
      maxlength=${s.maxlength ?? 200}
      placeholder=${s.placeholder ?? ""}
      ?required=${s.required ?? !1}
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${C(he(t, e))}
      @input=${(i) => t.set(e, ht(i))}
    />
    ${J(t, e)}
  </label>`;
}
function oe(t, e, n, s) {
  return o`<label class="field">
    <span>${n}</span>
    <textarea
      id=${Z(e)}
      name=${e}
      class="input"
      maxlength=${s}
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${C(he(t, e))}
      @input=${(i) => t.set(e, i.target.value)}
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
      .value=${C(he(t, e))}
      @input=${(s) => t.set(e, ht(s))}
    />
    ${J(t, e)}
  </label>`;
}
function Ke(t, e, n) {
  return R(t, e, n, { maxlength: 1e3 });
}
function Js(t, e, n, s) {
  const i = he(t, e);
  return o`<label class="field">
      <span>${n}</span>
      <input
        id=${Z(e)}
        name=${e}
        class="input"
        type="date"
        aria-invalid=${t.error(e) ? "true" : "false"}
        .value=${C(i)}
        @input=${(r) => {
    const a = ht(r);
    t.set(e, a), a || t.set(s, !1);
  }}
      />
      ${J(t, e)}
    </label>
    ${i ? xe(t, s, "Year unknown") : d}`;
}
function xe(t, e, n) {
  return o`<label class="check">
      <input
        id=${Z(e)}
        name=${e}
        type="checkbox"
        .checked=${C(t.get(e) === !0)}
        @change=${(s) => t.set(e, s.target.checked)}
      />
      ${n}
    </label>
    ${J(t, e)}`;
}
function mn(t, e, n, s) {
  const i = he(t, e);
  return o`<label class="field">
    <span>${n}</span>
    <select
      id=${Z(e)}
      name=${e}
      class="input"
      aria-invalid=${t.error(e) ? "true" : "false"}
      .value=${C(i)}
      @change=${(r) => t.set(e, r.target.value)}
    >
      ${s.map((r) => o`<option value=${r.value} ?selected=${r.value === i}>${r.label}</option>`)}
    </select>
    ${J(t, e)}
  </label>`;
}
const Xs = "https://claude.ai/new";
function Qs(t, e, n, s) {
  return t.drafts.open(e, n, () => {
    const { interaction_types: i, today: r } = $(t);
    return {
      type: s?.type ?? i[0] ?? "",
      date: s?.date ?? r,
      summary: s?.summary ?? "",
      notes: s?.notes ?? ""
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
  const s = n ? `edit:${n.id}` : `log:${e.id}`, i = Qs(t, s, n ? p.editInteraction(n.id) : p.logInteraction(e.id), n), r = $(t).interaction_types, a = () => {
    t.drafts.drop(s), B(n ? p.interaction(n.id) : p.person(e.id));
  }, l = (m) => t.drafts.patch(s, m), c = i.summary.trim() !== "" && i.date !== "" && i.type !== "", h = (m) => fn(t.writeError, m), u = (m) => {
    const g = h(m);
    return g ? o`<div class="field-error" role="alert" data-error-for=${m}>${g}</div>` : d;
  }, f = async () => {
    if (!c) return;
    const m = It(i), g = t.drafts.base(s);
    (n ? await t.updateInteraction(n.id, m, g && It(g)) : await t.addInteraction({ person_ids: [e.id], ...m })) && a();
  };
  return o`<div class="sheet-backdrop" @click=${(m) => m.target === m.currentTarget && a()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit interaction" : "Log interaction"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${a}>Cancel</button>
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
              ${r.map(
    (m) => o`<button
                  class="pill ${i.type === m ? "on" : ""}"
                  aria-pressed=${i.type === m ? "true" : "false"}
                  @click=${() => l({ type: m })}
                >
                  ${m}
                </button>`
  )}
            </div>
          </div>
          <label class="field">
            <span>Date</span>
            <input id="log-date" class="input" type="date" required .value=${C(i.date)}
              @input=${(m) => l({ date: m.target.value })} />
          </label>
          <label class="field">
            <span>Summary</span>
            <input id="log-summary" class="input" maxlength="300" aria-invalid=${h("summary") ? "true" : "false"}
              .value=${C(i.summary)} @input=${(m) => l({ summary: m.target.value })} />
            ${u("summary")}
          </label>
          <label class="field">
            <span>Notes</span>
            <textarea id="log-notes" class="input" maxlength="20000" aria-invalid=${h("notes") ? "true" : "false"}
              .value=${C(i.notes)} @input=${(m) => l({ notes: m.target.value })}></textarea>
            ${u("notes")}
          </label>
          <a href=${Xs} target="_blank" rel="noopener noreferrer" style="display:grid;justify-items:center;gap:8px;padding:8px 0">
            <span class="action primary" style="width:44px;height:44px;border-radius:50%">${b.mic}</span>
            <span class="muted" style="font-size:11.5px">Or tell Claude about it, and it logs it in Hearth for you.</span>
          </a>
        </div>
      </div>
    </div>
  </div>`;
}
function ei(t, e, n) {
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
function ti(t, e, n) {
  const s = ut(e.id);
  return N({
    title: "Delete this interaction?",
    lines: [`“${e.summary}” on ${cn(e.date)} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(s),
    onConfirm: async () => {
      await t.deleteInteraction(e.id) && (t.drafts.drop(s), B(n ? p.person(n.id) : p.home()));
    }
  });
}
function ni(t, e, n) {
  const { interactions: s, people: i } = $(t), r = s.find((c) => c.id === e);
  if (!r) return F("interaction");
  const a = dt(r, i), l = a[0];
  return {
    title: null,
    back: !0,
    actions: ei(t, r, l),
    body: o`<div class="page" style="padding:20px;display:grid;gap:18px">
      ${a.length ? o`<div style="display:grid;gap:12px">
            ${a.length > 1 ? o`<div class="label">People</div>` : d}
            ${a.map(
      (c) => o`<a href=${p.person(c.id)} style="display:flex;align-items:center;gap:12px">
                ${E(c.name, c.photo_url)}<span class="accent" style="font-weight:600;font-size:15px">${c.name}</span>
              </a>`
    )}
          </div>` : d}
      <div>
        <div class="label">${cn(r.date)}</div>
        <div class="mono accent" style="font-size:10.5px">${r.type}</div>
      </div>
      <div class="h-serif" style="font-size:19px">${r.summary}</div>
      ${r.notes ? o`<div><div class="label" style="margin-bottom:6px">Notes</div><div style="white-space:pre-wrap">${r.notes}</div></div>` : d}
    </div>`,
    overlay: o`${n === "edit" && l ? gn(t, l, r) : d}${t.drafts.get(ut(e)) ? ti(t, r, l) : d}`
  };
}
function Ht(t) {
  return t.birthday && !t.birth_year_unknown ? t.birthday : null;
}
function vn(t, e) {
  const n = Ht(t), s = Ht(e);
  return n && s && n !== s ? n < s ? -1 : 1 : n && !s ? -1 : !n && s ? 1 : O(t.name, e.name);
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
], si = new Map(yn.map((t, e) => [t, e]));
function Ot(t) {
  return (t === null ? void 0 : si.get(t)) ?? yn.length;
}
function ii(t) {
  return [...t].sort((e, n) => {
    const s = Ot(e.connectionType) - Ot(n.connectionType);
    return s !== 0 ? s : vn(e.person, n.person);
  });
}
const se = { parent: 0, unplaced: 1, child: 2 };
function ri(t, e) {
  const n = new Set(t), s = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), r = (l, c) => {
    c === "Parent" ? s.add(l) : c === "Child" && i.add(l);
  };
  for (const l of e)
    !n.has(l.person_a_id) || !n.has(l.person_b_id) || (r(l.person_b_id, l.type), r(l.person_a_id, l.inverse_type));
  const a = /* @__PURE__ */ new Map();
  for (const l of t)
    s.has(l) ? a.set(l, se.parent) : i.has(l) ? a.set(l, se.child) : a.set(l, se.unplaced);
  return a;
}
function pt(t, e, n, s) {
  const i = ri(e, n);
  return [...t].sort((r, a) => {
    const l = s(r), c = s(a), h = i.get(l.id) ?? se.unplaced, u = i.get(c.id) ?? se.unplaced;
    return h !== u ? h - u : vn(l, c);
  });
}
function Ie(t, e) {
  return t.person_a_id === t.person_b_id ? null : t.person_a_id === e ? { otherId: t.person_b_id, type: t.type } : t.person_b_id === e ? { otherId: t.person_a_id, type: t.inverse_type } : null;
}
function ai(t) {
  return t.householdMembers.length === 0 && t.others.length === 0 && t.groups.length === 0;
}
function oi(t, e) {
  const { people: n, households: s, groups: i, relationships: r, excludedId: a } = e, l = /* @__PURE__ */ new Map();
  for (const y of n) l.has(y.id) || l.set(y.id, y);
  const c = /* @__PURE__ */ new Map(), h = [];
  for (const y of r) {
    const v = Ie(y, t);
    !v || v.otherId === a || c.has(v.otherId) || (c.set(v.otherId, { type: v.type, relationshipId: y.id }), h.push(v.otherId));
  }
  const u = (y) => {
    const v = l.get(y), S = c.get(y);
    return v ? { person: v, connectionType: S?.type ?? null, relationshipId: S?.relationshipId ?? null } : null;
  }, f = /* @__PURE__ */ new Set([t]), m = s.find((y) => y.member_ids.includes(t)) ?? null, g = [];
  for (const y of m?.member_ids ?? []) {
    if (y === a || f.has(y)) continue;
    f.add(y);
    const v = u(y);
    v && g.push(v);
  }
  const w = pt(g, m?.member_ids ?? [], r, (y) => y.person), j = ii(
    h.filter((y) => !f.has(y)).map(u).filter((y) => y !== null)
  );
  return {
    // Dropped when nobody is left to list under it, so the view never draws a household
    // heading over an empty group.
    household: w.length === 0 ? null : m,
    householdMembers: w,
    others: j,
    groups: i.filter((y) => y.member_ids.includes(t)).sort((y, v) => O(y.name, v.name))
  };
}
function ft(t, e, n) {
  const s = [...e].sort(qe);
  if (t === "") return { direct: s, connected: [] };
  const i = t.toLocaleLowerCase(), r = s.filter((u) => u.name.toLocaleLowerCase().includes(i)), a = new Map(r.map((u) => [u.id, u])), l = /* @__PURE__ */ new Map();
  for (const u of s) l.has(u.id) || l.set(u.id, u);
  const c = [], h = new Set(a.keys());
  for (const u of n) {
    const f = [u.person_a_id, u.person_b_id].find((j) => a.has(j));
    if (f === void 0) continue;
    const m = Ie(u, f);
    if (!m || h.has(m.otherId)) continue;
    h.add(m.otherId);
    const g = l.get(m.otherId), w = a.get(f);
    !g || !w || c.push({ person: g, reason: `${m.type} of ${w.name}` });
  }
  return { direct: r, connected: c.sort((u, f) => qe(u.person, f.person)) };
}
const li = 8;
function mt(t, e) {
  const { people: n, relationships: s } = $(t), i = `picker:${e.id}`, r = t.drafts.open(i, e.path, () => ({ query: "" })).query, a = e.selected ?? [], l = /* @__PURE__ */ new Set([...e.exclude ?? [], ...a]), c = a.map((g) => n.find((w) => w.id === g)).filter((g) => !!g), h = r.trim(), u = [];
  if (h) {
    const g = ft(h, n, s);
    for (const w of g.direct) u.push({ person: w });
    for (const w of g.connected) u.push(w);
  }
  const f = u.filter((g) => !l.has(g.person.id)).slice(0, li), m = (g) => {
    t.drafts.patch(i, { query: "" }), e.onPick(g);
  };
  return o`<div class="field person-picker">
    <label for=${e.id}><span>${e.label}</span></label>
    ${c.length ? o`<div class="chips">
          ${c.map(
    (g) => o`<span class="chip">
              ${E(g.name, g.photo_url, 18)} ${g.name}
              ${e.onRemove ? o`<button
                    class="chip-remove"
                    aria-label=${`Remove ${g.name}`}
                    title=${`Remove ${g.name}`}
                    ?disabled=${e.disabled ?? !1}
                    @click=${() => e.onRemove(g.id)}
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
      .value=${C(r)}
      @input=${(g) => t.drafts.patch(i, { query: g.target.value })}
    />
    ${h ? o`<div class="list">
          ${f.length ? f.map(
    ({ person: g, reason: w }) => o`<button
                  class="row picker-choice"
                  ?disabled=${e.disabled ?? !1}
                  @click=${() => m(g.id)}
                >
                  ${E(g.name, g.photo_url)}
                  <span class="main">
                    <div class="name">${g.name}</div>
                    ${w ? o`<div class="sub">${w}</div>` : d}
                  </span>
                </button>`
  ) : o`<div class="empty">No one matches “${h}”.</div>`}
        </div>` : d}
  </div>`;
}
const bn = "That file isn't a photo Hearth can use.", ci = 4e6;
class ee extends Error {
  constructor(e = bn) {
    super(e), this.name = "PhotoUnusable";
  }
}
const $n = {
  decode: (t) => createImageBitmap(t, { imageOrientation: "from-image" }),
  async encode(t, e, n, s) {
    const i = t;
    if (typeof OffscreenCanvas < "u") {
      const a = new OffscreenCanvas(e, n);
      return Lt(a.getContext("2d"), i, e, n), a.convertToBlob({ type: "image/jpeg", quality: s });
    }
    const r = document.createElement("canvas");
    return r.width = e, r.height = n, Lt(r.getContext("2d"), i, e, n), new Promise(
      (a, l) => r.toBlob((c) => c ? a(c) : l(new Error("encoding failed")), "image/jpeg", s)
    );
  }
};
function Lt(t, e, n, s) {
  if (!t) throw new Error("no 2d canvas");
  t.fillStyle = "white", t.fillRect(0, 0, n, s), t.drawImage(e, 0, 0, n, s);
}
function di(t) {
  let e = "";
  for (let s = 0; s < t.length; s += 32768) e += String.fromCharCode(...t.subarray(s, s + 32768));
  return btoa(e);
}
async function hi(t, e = 1024, n = 0.85, s = $n) {
  let i;
  try {
    i = await s.decode(t);
  } catch {
    throw new ee();
  }
  try {
    const { width: r, height: a } = i;
    if (!(r > 0 && a > 0)) throw new ee();
    const l = Math.min(1, e / Math.max(r, a)), c = Math.max(1, Math.round(r * l)), h = Math.max(1, Math.round(a * l));
    let u;
    try {
      u = await s.encode(i, c, h, n);
    } catch {
      throw new ee();
    }
    let f;
    try {
      f = di(new Uint8Array(await u.arrayBuffer()));
    } catch {
      throw new ee();
    }
    if (f.length > ci) throw new ee();
    return f;
  } finally {
    i.close?.();
  }
}
async function ui(t, e, n, s, i = $n) {
  if (t.shrinkingPhoto) return !1;
  let r;
  t.setShrinkingPhoto(!0);
  try {
    r = await hi(s, 1024, 0.85, i);
  } catch {
    return t.showToast(bn), !1;
  } finally {
    t.setShrinkingPhoto(!1);
  }
  return t.setPhoto(e, n, r);
}
function _n(t, e, n, s) {
  return o`<input class="file-input" type="file" accept="image/*" ?disabled=${s} @change=${(r) => {
    const a = r.target, l = a.files?.[0];
    a.value = "", l && ui(t, e, n, l);
  }} />`;
}
const xn = (t) => t.busy || t.shrinkingPhoto;
function gt(t, e) {
  const { kind: n, id: s, name: i, photoUrl: r } = e, a = xn(t);
  return o`<div class="photo-picker">
    ${E(i, r, 76)}
    <div class="actions">
      <label class="btn secondary file-btn" aria-disabled=${a ? "true" : "false"}>
        ${t.shrinkingPhoto ? "Preparing photo…" : r ? "Change photo" : "Add photo"} ${_n(t, n, s, a)}
      </label>
      ${r ? o`<button class="btn secondary" ?disabled=${a} @click=${() => void t.clearPhoto(n, s)}>Remove photo</button>` : d}
    </div>
  </div>`;
}
function pi(t, e, n = 76) {
  const { kind: s, id: i, name: r, photoUrl: a } = e, l = xn(t), c = a ? "Change photo" : "Add photo";
  return o`<label class="file-btn photo-tap" aria-label=${c} title=${c} aria-disabled=${l ? "true" : "false"}>
    ${E(r, a, n)} ${_n(t, s, i, l)}
  </label>`;
}
function vt(t, e) {
  const n = /* @__PURE__ */ new Map();
  for (const r of e) n.has(r.id) || n.set(r.id, r);
  const s = /* @__PURE__ */ new Set(), i = [];
  for (const r of t) {
    if (s.has(r)) continue;
    s.add(r);
    const a = n.get(r);
    a && i.push(a);
  }
  return i.sort(qe);
}
const wn = (t) => `edit:group:${t}`, me = "edit:group:new", Ye = (t) => `confirm-delete:group:${t}`, ze = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`;
function kn(t, e, n) {
  const s = de(t, e), i = { ...s, error: (r) => r === "name" && n ? "Enter a name." : s.error(r) };
  return o`${R(i, "name", "Name", { required: !0, maxlength: 200 })}
  ${oe(i, "description", "Description", 2e4)}`;
}
function fi(t) {
  const n = !t.drafts.open(me, p.newGroup(), () => ({ name: "", description: "" })).name.trim(), s = async () => {
    const i = t.drafts.get(me);
    if (!i || !i.name.trim()) return;
    const r = await t.save("contact_group", null, { ...i });
    r && (t.drafts.drop(me), L(p.editGroup(r.id), !0));
  };
  return {
    title: "New group",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${kn(t, me, n)}
      <button class="btn" ?disabled=${n || t.busy} @click=${s}>Create group</button>
    </div>`
  };
}
function mi(t, e) {
  const n = vt(e.member_ids, $(t).people);
  return mt(t, {
    id: "group-members",
    label: "Add a member",
    path: p.editGroup(e.id),
    selected: n.map((s) => s.id),
    // Built from store.groupMembers, so a change made before the last one reaches the snapshot isn't undone.
    onPick: (s) => void t.setGroupMembers(e.id, [...t.groupMembers(e.id).filter((i) => i !== s), s]),
    onRemove: (s) => void t.setGroupMembers(e.id, t.groupMembers(e.id).filter((i) => i !== s)),
    disabled: t.busy
  });
}
function gi(t, e) {
  const n = Ye(e.id), s = e.member_ids.length;
  return N({
    title: `Delete ${e.name}?`,
    lines: [`${s} ${s === 1 ? "person stays" : "people stay"}; they just leave this group.`, "This can't be undone."],
    confirmLabel: "Delete group",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("contact_group", e.id) && (t.drafts.drop(n), t.drafts.drop(wn(e.id)), t.setSearch({ chip: "groups" }), L(p.search(), !0));
    }
  });
}
function vi(t, e) {
  const n = $(t).groups.find((c) => c.id === e);
  if (!n) return t.isArriving(e) ? Ne : F("group");
  const s = wn(e), i = p.editGroup(e), a = !t.drafts.open(s, i, () => ({ name: n.name, description: n.description ?? "" })).name.trim(), l = async () => {
    const c = t.drafts.get(s), h = t.drafts.base(s);
    !c || !h || !c.name.trim() || await t.save("contact_group", e, { ...c }, { ...h }) && (t.drafts.drop(s), B(p.group(e)));
  };
  return {
    title: "Edit group",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${ze("Photo", gt(t, { kind: "contact_group", id: e, name: n.name, photoUrl: n.photo_url }))}
      ${ze("Details", kn(t, s, a))}
      <button class="btn" ?disabled=${a || t.busy} @click=${l}>Save</button>
      ${ze("Members", mi(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(Ye(e), i, {})}>
        Delete group
      </button>
    </div>`,
    overlay: t.drafts.get(Ye(e)) ? gi(t, n) : void 0
  };
}
const yi = "Name (leave blank to use the generated name)", Cn = (t) => `edit:household:${t}`, ge = "edit:household:new", He = (t) => `confirm-delete:household:${t}`, Oe = (t) => `confirm-dissolve:household:${t}`, Le = (t) => `confirm-move:household:${t}`, Ge = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`, We = (t) => ({ name_override: t.name_override, address: t.address, notes: t.notes });
function En(t, e) {
  const n = R(t, "name_override", yi, { maxlength: 200 });
  return o`${e ? o`<div class="highlight">${n}</div>` : n} ${Ke(t, "address", "Address")}
  ${oe(t, "notes", "Notes", 2e4)}`;
}
function bi(t) {
  const e = p.newHousehold();
  t.drafts.open(ge, e, () => ({ name_override: "", address: "", notes: "" }));
  const n = async () => {
    const s = t.drafts.get(ge);
    if (!s) return;
    const i = await t.save("household", null, We(s));
    i && (t.drafts.drop(ge), L(p.editHousehold(i.id), !0));
  };
  return {
    title: "New household",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${En(de(t, ge), !1)}
      <button class="btn" ?disabled=${t.busy} @click=${n}>Create household</button>
    </div>`
  };
}
function $i(t, e) {
  const n = p.editHousehold(e.id);
  let s = d;
  switch (e.name_status) {
    case "generated":
      s = o`<div class="muted" style="font-size:12.5px">Named from its members.</div>`;
      break;
    case "override":
      s = o`<div class="muted" style="font-size:12.5px">The name you gave it.</div>`;
      break;
    case "needs_name":
      s = o`<div class="warning household-status" style="font-size:12.5px">This household needs a name</div>`;
      break;
    case "not_a_household":
      s = o`<div class="warning household-status" style="font-size:12.5px">
          This isn't a household any more (one adult, no children)
        </div>
        <button
          class="btn secondary"
          style="justify-self:start"
          ?disabled=${t.busy}
          @click=${() => t.drafts.put(Oe(e.id), n, {})}
        >
          Dissolve household
        </button>`;
      break;
  }
  return o`<div style="display:grid;gap:6px">
    <div class="h-serif members-title ${W(e) ? "" : "muted"}" style="font-size:21px">${I(e)}</div>
    ${s}
  </div>`;
}
const Ze = (t, e, n) => t.save("person", e, { household_id: n });
function _i(t, e) {
  const { people: n, relationships: s } = $(t), i = pt(vt(e.member_ids, n), e.member_ids, s, (l) => l), r = p.editHousehold(e.id), a = (l) => {
    const c = n.find((h) => h.id === l);
    if (c?.household_id && c.household_id !== e.id) {
      t.drafts.put(Le(e.id), r, { personId: l });
      return;
    }
    Ze(t, l, e.id);
  };
  return mt(t, {
    id: "household-members",
    label: "Add a member",
    path: r,
    selected: i.map((l) => l.id),
    onPick: a,
    onRemove: (l) => void Ze(t, l, null),
    disabled: t.busy
  });
}
function xi(t, e, n) {
  const s = Le(e.id), i = $(t), r = i.households.find((l) => l.id === n.household_id), a = r ? ct(r, i.people) : "their household";
  return N({
    title: `Move ${n.name} from ${a} to this household?`,
    lines: ["A person can only be in one household."],
    confirmLabel: "Move",
    busy: t.busy,
    onCancel: () => t.drafts.drop(s),
    onConfirm: async () => {
      await Ze(t, n.id, e.id) && t.drafts.drop(s);
    }
  });
}
const wi = (t) => `${t} ${t === 1 ? "person stays" : "people stay"}; they just won't have a household.`;
function An(t, e) {
  for (const n of [Cn(e), He(e), Oe(e), Le(e)]) t.drafts.drop(n);
  t.setSearch({ chip: "households" }), L(p.search(), !0);
}
function ki(t, e) {
  const n = He(e.id);
  return N({
    title: `Delete ${I(e)}?`,
    lines: [wi(e.member_ids.length), "This can't be undone."],
    confirmLabel: "Delete household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && An(t, e.id);
    }
  });
}
function Ci(t, e) {
  const n = Oe(e.id);
  return N({
    title: "Dissolve this household?",
    lines: ["Members stay; they just won't have a household."],
    confirmLabel: "Dissolve household",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("household", e.id) && An(t, e.id);
    }
  });
}
function Ei(t, e) {
  const n = e.id;
  if (t.drafts.get(He(n))) return ki(t, e);
  if (t.drafts.get(Oe(n))) return Ci(t, e);
  const s = t.drafts.get(Le(n)), i = s && $(t).people.find((r) => r.id === s.personId);
  return i ? xi(t, e, i) : void 0;
}
function Ai(t, e) {
  const n = $(t).households.find((a) => a.id === e);
  if (!n) return t.isArriving(e) ? Ne : F("household");
  const s = Cn(e), i = p.editHousehold(e);
  t.drafts.open(s, i, () => ({
    name_override: n.name_override ?? "",
    address: n.address?.formatted ?? "",
    notes: n.notes ?? ""
  }));
  const r = async () => {
    const a = t.drafts.get(s), l = t.drafts.base(s);
    !a || !l || await t.save("household", e, We(a), We(l)) && (t.drafts.drop(s), B(p.household(e)));
  };
  return {
    title: "Edit household",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${$i(t, n)}
      ${Ge("Photo", gt(t, { kind: "household", id: e, name: I(n), photoUrl: n.photo_url }))}
      ${Ge("Details", En(de(t, s), n.name_status === "needs_name"))}
      <button class="btn" ?disabled=${t.busy} @click=${r}>Save</button>
      ${Ge("Members", _i(t, n))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${t.busy} @click=${() => t.drafts.put(He(e), i, {})}>
        Delete household
      </button>
    </div>`,
    overlay: Ei(t, n)
  };
}
function Sn(t, e, n, s) {
  const { people: i, relationships: r } = $(t), a = vt(n, i), l = s ? pt(a, n, r, (c) => c) : a;
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
        <div class="label" style="margin-top:6px">${Me(l.length, "member").toUpperCase()}</div>
      </div>
      <div class="list">${l.map((c) => Ve(c))}</div>
    </div>`
  };
}
function Si(t, e) {
  const n = $(t).households.find((a) => a.id === e);
  if (!n) return F("household");
  const s = p.editHousehold(e), i = n.name_status === "needs_name" ? { text: "This household needs a name. Name it", href: s } : n.name_status === "not_a_household" ? { text: "This isn't a household any more. Review it", href: s } : null, r = { title: I(n), muted: !W(n), subtitle: null, prompt: i, editHref: s };
  return Sn(t, r, n.member_ids, !0);
}
function Ti(t, e) {
  const n = $(t).groups.find((s) => s.id === e);
  return n ? Sn(t, { title: n.name, muted: !1, subtitle: n.description, prompt: null, editHref: p.editGroup(e) }, n.member_ids, !1) : F("group");
}
function Tn(t) {
  if (!t) return null;
  if (t.startsWith("+")) {
    const n = t.slice(1).replace(/\D/g, "");
    return n.length >= 8 ? `+${n}` : null;
  }
  const e = t.replace(/\D/g, "");
  return e.length === 10 ? `+1${e}` : e.length === 11 && e.startsWith("1") ? `+${e}` : null;
}
function Ri(t) {
  const e = Tn(t);
  return e ? `tel:${e}` : null;
}
function Mi(t) {
  const e = Tn(t);
  return e ? `sms:${e}` : null;
}
function Pi(t) {
  const e = t?.trim() ?? "";
  return e === "" || /\s/.test(e) ? null : `mailto:${e}`;
}
function Ut(t) {
  return t ? typeof t.lat == "number" && typeof t.lon == "number" ? !0 : (t.formatted?.trim() ?? "") !== "" : !1;
}
function Ni(t, e) {
  return Ut(t.address) ? t.address : Ut(e?.address) ? e.address : null;
}
function Ii(t, e) {
  const n = Ni(t, e);
  if (!n) return null;
  const s = n.formatted ?? "";
  return typeof n.lat == "number" && typeof n.lon == "number" ? `https://maps.apple.com/?ll=${n.lat},${n.lon}&q=${encodeURIComponent(s)}` : s ? `https://maps.apple.com/?q=${encodeURIComponent(s)}` : null;
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
const Hi = "/config/integrations/integration/hearth_crm", Rn = "contact missing", Mn = "create uncertain", we = "confirm-google-enable", ke = "confirm-google-clear";
function Pn(t) {
  switch (t) {
    case Rn:
      return "This contact was deleted in Google.";
    case Mn:
      return "Hearth couldn't confirm whether Google created this contact.";
    default:
      return t;
  }
}
function Nn(t) {
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
function Oi(t) {
  const e = new Date(t);
  return Number.isNaN(e.getTime()) ? t : e.toLocaleString();
}
function In(t) {
  const e = [`${t.created} created`, `${t.updated} updated`];
  return t.photos && e.push(`${t.photos} photos`), t.errors && e.push(`${t.errors} with errors`), t.missing && e.push(`${t.missing} missing in Google`), t.pending && e.push(`${t.pending} still to do`), e.join(", ");
}
function Li() {
  return o`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">
      Hearth can keep your contacts in your Google account up to date. It's optional, and Hearth works the same without it.
    </div>
    <div class="muted" style="font-size:12.5px">
      To connect: Settings → Devices & services → Hearth → Reconfigure.
    </div>
    <a class="accent" style="font-size:12.5px" href=${Hi} target="_blank" rel="noopener noreferrer">Open Hearth in Home Assistant</a>
  </div>`;
}
function Ui(t) {
  const { counts: e, last_run: n } = t, s = n ? Nn(n) : null;
  return o`<div id="google-status" style="display:grid;gap:4px;font-size:12.5px">
    <div>
      ${e.synced} synced, ${e.pending} waiting, ${e.skipped} skipped${e.missing ? o`, ${e.missing} missing in Google` : d}${e.errors ? o`, ${e.errors} with errors` : d}
    </div>
    ${t.running ? o`<div class="muted">Syncing now…</div>` : d}
    ${n && !n.dry_run ? o`<div class="muted">Last run ${Oi(n.started_at)}: ${In(n)}</div>` : o`<div class="muted">No sync has run yet.</div>`}
    ${s ? o`<div role="alert">${s}</div>` : d}
    ${t.last_error ? o`<div role="alert">The last run failed: ${t.last_error}</div>` : d}
  </div>`;
}
function Di(t, e) {
  const n = !e.cutover_confirmed && !e.enabled, s = (i) => {
    const r = i.target;
    r.checked ? (r.checked = !1, t.drafts.put(we, p.settings(), {})) : t.setGoogleEnabled(!1);
  };
  return o`<div style="display:grid;gap:4px">
    <label class="check">
      <input
        id="google-enable"
        type="checkbox"
        role="switch"
        ?disabled=${n || t.busy}
        aria-describedby=${n ? "google-enable-why" : d}
        .checked=${C(e.enabled)}
        @change=${s}
      />
      <span>Keep Google Contacts up to date</span>
    </label>
    ${n ? o`<div class="muted" id="google-enable-why" style="font-size:12.5px">
          Available once cutover is confirmed, so test edits in Hearth never reach your Google account. Run the Hearth “Confirm cutover” action (Developer tools → Actions) once your import is final. You can still preview below.
        </div>` : d}
  </div>`;
}
function zi(t) {
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
function Gi(t) {
  const e = Nn(t);
  return o`<div id="google-sync-result" role="status" style="display:grid;gap:4px;font-size:12.5px">
    <div>Sync finished: ${In(t)}</div>
    ${e ? o`<div>${e}</div>` : d}
  </div>`;
}
function Bi(t) {
  return $(t).people.filter((e) => e.google_sync_error);
}
function Fi(t) {
  const e = Bi(t);
  return e.length ? o`<div id="google-problems" style="display:grid;gap:10px">
    <div class="label" style="padding:0">Needs attention</div>
    ${e.map((n) => {
    const s = n.google_sync_error, i = s === Mn && !n.google_contact_id, r = i || s === Rn && !!n.google_contact_id;
    return o`<div class="google-problem" style="display:flex;align-items:center;gap:10px">
        <span style="flex:1;min-width:0">
          <a href=${p.person(n.id)} style="font-weight:600">${n.name}</a>
          <div class="muted" style="font-size:12.5px">${Pn(s)}</div>
        </span>
        ${r ? o`<button
              class="btn secondary"
              ?disabled=${t.busy}
              @click=${() => t.drafts.put(ke, p.settings(), { personId: n.id, uncertain: i })}
            >
              Create a new contact
            </button>` : d}
      </div>`;
  })}
  </div>` : d;
}
function ji(t) {
  const { status: e, loadError: n, preview: s, lastSync: i, working: r } = t.google;
  return e ? e.connected ? o`<div class="card" style="padding:13px;display:grid;gap:12px">
    ${n ? o`<div class="muted" id="google-refresh-error" role="status" style="font-size:12.5px">Couldn't refresh Google status</div>` : d}
    ${Ui(e)} ${Di(t, e)}
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
    ${s ? zi(s) : d} ${i ? Gi(i) : d} ${Fi(t)}
  </div>` : Li() : o`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${n ? `Couldn't load the Google sync status: ${n}` : "Loading…"}</div>
    </div>`;
}
function Vi(t) {
  if (t.drafts.get(we))
    return N({
      title: "Turn on Google sync?",
      lines: ["Contacts will be created and updated in your Google account. Hearth never deletes a Google contact."],
      confirmLabel: "Turn on",
      busy: t.busy,
      onCancel: () => t.drafts.drop(we),
      onConfirm: () => {
        t.drafts.drop(we), t.setGoogleEnabled(!0);
      }
    });
  const e = t.drafts.get(ke);
  if (e)
    return N({
      title: "Create a new contact?",
      lines: [
        e.uncertain ? "Hearth couldn't confirm whether Google created this contact. Check Google Contacts for a stray copy first; a new one will be created." : "A new contact will be created in Google. The old one is not touched."
      ],
      confirmLabel: "Create new contact",
      busy: t.busy,
      onCancel: () => t.drafts.drop(ke),
      onConfirm: () => {
        t.drafts.drop(ke), t.clearGoogleContact(e.personId);
      }
    });
}
function ye(t, e, n) {
  return o`<a class="action" href=${n} target="_blank" rel="noopener noreferrer" aria-label=${e} title=${e}
    >${t}</a
  >`;
}
function qi(t, e) {
  const n = Ri(t.phone), s = Mi(t.phone), i = Pi(t.email), r = Ii(t, e);
  return o`<div class="actions-row">
    <a class="action primary" href=${p.logInteraction(t.id)} aria-label="Log interaction" title="Log interaction"
      >${b.plus}</a
    >
    ${n ? ye(b.phone, "Call", n) : d} ${s ? ye(b.message, "Message", s) : d}
    ${i ? ye(b.envelope, "Email", i) : d} ${r ? ye(b.mapPin, "Map", r) : d}
  </div>`;
}
function Ki(t, e) {
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
const Dt = o`<div style="border-top:1px solid var(--border);margin:9px 0"></div>`;
function Yi(t) {
  const e = W(t);
  return o`<a href=${p.household(t.id)} style="display:flex;justify-content:space-between;padding-bottom:2px">
    <span class="mono household-name ${e ? "accent" : "muted"}" style="font-size:9.5px"
      >${e ? I(t).toUpperCase() : I(t)}</span
    >
    <span class="mono muted" style="font-size:9px">HOUSEHOLD</span>
  </a>`;
}
function Wi(t, e) {
  const { people: n, households: s, groups: i, relationships: r, me_person_id: a } = e, l = oi(t.id, { people: n, households: s, groups: i, relationships: r, excludedId: a }), c = (u) => Ki(t.id, u), h = o`<a class="accent add-relationship" href=${p.newRelationship(t.id)} style="display:block;font-size:12.5px;padding:8px 20px 18px"
    >Add relationship</a
  >`;
  return ai(l) ? o`<div class="label" style="padding:0 20px 8px">Connections</div>${h}` : o`<div class="label" style="padding:0 20px 8px">Connections</div>
    <div class="card">
      ${l.household ? o`${Yi(l.household)} ${l.householdMembers.map(c)}` : d}
      ${l.others.length ? o`${l.household ? o`${Dt}<div class="mono muted" style="font-size:9.5px">ELSEWHERE</div>` : d}
          ${l.others.map(c)}` : d}
      ${l.groups.length ? o`${l.household || l.others.length ? Dt : d}
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
function Zi(t) {
  const n = [
    [ve(t.website), b.globe, "Website"],
    [ve(t.linkedin), b.linkedIn, "LinkedIn profile"],
    [ve(t.facebook), b.facebook, "Facebook profile"],
    [ve(t.instagram), b.instagram, "Instagram profile"]
  ].filter(([s]) => s);
  return n.length ? o`<div style="display:flex;gap:14px;padding:0 20px 18px">
    ${n.map(
    ([s, i, r]) => o`<a class="accent" style="width:22px;height:22px;display:inline-flex" href=${s ?? ""} target="_blank" rel="noopener noreferrer" aria-label=${r} title=${r}
          >${i}</a
        >`
  )}
  </div>` : d;
}
function Ji(t) {
  return t.length ? o`<div class="label" style="padding:0 20px 8px">Timeline</div>
    <div style="display:grid;gap:16px;padding:0 20px 20px">
      ${t.map(
    (e) => o`<a href=${p.interaction(e.id)} style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:11px;height:11px;border:2px solid var(--accent);border-radius:50%;margin-top:3px;flex:none"></span>
          <span>
            <div class="mono muted" style="font-size:9.5px">${Ss(e.date).toUpperCase()} · ${e.type.toUpperCase()}</div>
            <div style="font-weight:600;font-size:13px">${e.summary}</div>
          </span>
        </a>`
  )}
    </div>` : d;
}
function Hn(t, e, n) {
  const s = $(t), i = s.people.find((c) => c.id === e);
  if (!i) return t.isArriving(e) ? Ne : F("person");
  const r = i.household_id ? s.households.find((c) => c.id === i.household_id) ?? null : null, a = [i.occupation, i.employer].filter(Boolean).join(" - "), l = i.how_i_know_them?.trim();
  return {
    title: null,
    back: !0,
    actions: [
      { icon: b.pencil, label: "Edit", href: p.editPerson(i.id) },
      {
        icon: i.favorite ? b.starFill : b.star,
        label: i.favorite ? "Remove from favorites" : "Add to favorites",
        className: i.favorite ? "accent" : "muted",
        onClick: () => void t.toggleFavorite(i)
      }
    ],
    body: o`<div class="page">
      <div style="display:grid;justify-items:center;gap:6px;padding:8px 20px 18px;text-align:center">
        ${pi(t, { kind: "person", id: i.id, name: i.name, photoUrl: i.photo_url })}
        <div class="h-serif" style="font-size:21px">${i.name}</div>
        ${a ? o`<div class="muted" style="font-size:12.5px">${a}</div>` : d}
        ${l ? o`<div class="muted" style="font-size:12.5px">${l}</div>` : d}
        ${i.birthday ? o`<div class="muted" style="font-size:12.5px">${Ts(i.birthday, i.birth_year_unknown, i.age)}</div>` : d}
        ${i.close_friend ? o`<div class="mono accent" style="font-size:10px;padding:4px 12px;border:1px dashed var(--thread);border-radius:999px;margin-top:4px">
              ◆ Close Friend rotation
            </div>` : d}
      </div>
      ${i.google_sync_error ? o`<a class="notice google-error" href=${p.settings()} style="display:block">Google sync: ${Pn(i.google_sync_error)}</a>` : d}
      ${qi(i, r)}
      ${i.relationship_summary ? o`<div class="label" style="padding:0 20px 8px">Relationship summary</div>
            <div class="card" style="border-left:3px solid var(--accent);padding:14px;font-size:12.5px;white-space:pre-wrap">${i.relationship_summary}</div>` : d}
      ${Wi(i, s)} ${Zi(i)} ${Ji(Vs(s.interactions, i.id))}
    </div>`,
    overlay: n === "log" ? gn(t, i, null) : void 0
  };
}
const Je = "new", On = [
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
], Xi = ["favorite", "close_friend", "hide_from_list"], yt = (t) => `edit:person:${t}`, Xe = (t) => `confirm-delete:person:${t}`;
function Qi(t, e) {
  return t.groups.filter((n) => n.member_ids.includes(e)).map((n) => n.id);
}
function er(t, e) {
  return {
    ...Object.fromEntries(On.map((s) => [s, t[s] ?? ""])),
    favorite: t.favorite,
    close_friend: t.close_friend,
    hide_from_list: t.hide_from_list,
    birthday: t.birthday ?? "",
    birth_year_unknown: t.birth_year_unknown,
    address: t.address?.formatted ?? "",
    school: t.school?.formatted ?? "",
    household_id: t.household_id ?? "",
    group_ids: Qi(e, t.id),
    saving: !1
  };
}
function zt(t, e) {
  const n = {};
  for (const s of On) n[s] = t[s];
  for (const s of Xi) n[s] = t[s];
  return n.birthday = t.birthday, n.birth_year_unknown = t.birthday !== "" && t.birth_year_unknown, n.address = t.address, n.school = t.school, n.household_id = e, n;
}
function tr(t, e) {
  const n = t.relationships.filter((c) => c.person_a_id === e || c.person_b_id === e).length, s = t.groups.filter((c) => c.member_ids.includes(e)).length, i = t.interactions.filter((c) => c.person_ids.includes(e)), r = i.filter((c) => c.person_ids.every((h) => h === e)).length, a = i.length - r, l = (c, h, u) => `${c} ${c === 1 ? h : u}`;
  return `Also removes ${l(n, "relationship", "relationships")} and ${l(s, "group membership", "group memberships")}. ${l(r, "interaction with only them is", "interactions with only them are")} deleted; ${l(a, "shared interaction keeps", "shared interactions keep")} the other people.`;
}
function nr(t, e) {
  const n = e.household_id ? t.households.find((s) => s.id === e.household_id) : void 0;
  return n ? [`They leave ${ct(n, t.people)}.`] : [];
}
function sr(t, e) {
  const n = Xe(e.id), s = $(t);
  return N({
    title: `Delete ${e.name}?`,
    lines: [tr(s, e.id), ...nr(s, e), "This can't be undone."],
    confirmLabel: "Delete",
    busy: t.busy,
    onCancel: () => t.drafts.drop(n),
    onConfirm: async () => {
      await t.remove("person", e.id) && (t.drafts.drop(n), t.drafts.drop(yt(e.id)), L(p.home(), !0));
    }
  });
}
async function ir(t, e) {
  const n = yt(e.id), s = t.drafts.get(n), i = t.drafts.base(n);
  if (!(!s || !i || s.saving || !s.name.trim())) {
    t.drafts.patch(n, { saving: !0 });
    try {
      let r = s.household_id || null;
      if (r === Je) {
        const l = await t.save("household", null, {});
        if (!l) return;
        r = l.id, t.drafts.patch(n, { household_id: r });
      }
      const a = zt(i, i.household_id || null);
      if (!await t.save("person", e.id, zt(s, r), a)) return;
      for (const l of $(t).groups) {
        const c = s.group_ids.includes(l.id);
        if (i.group_ids.includes(l.id) === c) continue;
        const h = t.groupMembers(l.id);
        if (h.includes(e.id) === c) continue;
        const u = c ? [...h, e.id] : h.filter((f) => f !== e.id);
        if (!await t.setGroupMembers(l.id, u)) return;
      }
      t.drafts.drop(n), B(p.person(e.id));
    } finally {
      t.drafts.patch(n, { saving: !1 });
    }
  }
}
const M = (t, e) => o`<div class="label form-section">${t}</div>
    ${e}`;
function rr(t, e) {
  const n = t.households.map((s) => ({ value: s.id, label: ct(s, t.people) })).sort((s, i) => O(s.label, i.label));
  return e && e !== Je && !n.some((s) => s.value === e) && n.push({ value: e, label: "New household" }), [{ value: "", label: "None" }, ...n, { value: Je, label: "New household…" }];
}
function ar(t, e, n, s) {
  if (!n.groups.length) return o`<div class="muted" style="font-size:12.5px">No groups yet.</div>`;
  const i = [...n.groups].sort((a, l) => O(a.name, l.name)), r = (a, l) => {
    const c = t.drafts.get(e)?.group_ids ?? [], h = l ? [...c.filter((u) => u !== a), a] : c.filter((u) => u !== a);
    t.drafts.patch(e, { group_ids: h });
  };
  return o`<div role="group" aria-label="Groups">
    ${i.map(
    (a) => o`<label class="check">
        <input
          type="checkbox"
          data-group=${a.id}
          .checked=${C(s.includes(a.id))}
          @change=${(l) => r(a.id, l.target.checked)}
        />
        ${a.name}
      </label>`
  )}
  </div>`;
}
function or(t, e) {
  const n = $(t), s = n.people.find((f) => f.id === e);
  if (!s) return t.isArriving(e) ? Ne : F("person");
  const i = yt(e), r = p.editPerson(e), a = t.drafts.open(i, r, () => er(s, n)), l = !a.name.trim(), c = de(t, i), h = { ...c, error: (f) => f === "name" && l ? "Enter a name." : c.error(f) }, u = l || a.saving || t.busy;
  return {
    title: "Edit person",
    back: !0,
    actions: [],
    body: o`<div class="page form">
      ${M("Photo", gt(t, { kind: "person", id: e, name: s.name, photoUrl: s.photo_url }))}
      ${M(
      "Basics",
      o`${R(h, "name", "Name", { required: !0, maxlength: 200 })}
        ${R(h, "how_i_know_them", "How I know them", { maxlength: 2e3 })}
        ${R(h, "occupation", "Occupation", { maxlength: 300 })} ${R(h, "employer", "Employer", { maxlength: 300 })}`
    )}
      ${M(
      "Contact",
      o`${R(h, "phone", "Phone", { type: "tel", autocomplete: "tel", maxlength: 50 })}
        ${R(h, "phone2", "Phone 2", { type: "tel", maxlength: 50 })}
        ${R(h, "email", "Email", { type: "email", autocomplete: "email", maxlength: 500 })}
        ${R(h, "email2", "Email 2", { type: "email", maxlength: 500 })}`
    )}
      ${M("Dates", Js(h, "birthday", "Birthday", "birth_year_unknown"))}
      ${M(
      "Flags",
      o`${xe(h, "favorite", "Favorite")} ${xe(h, "close_friend", "Close friend")}
        ${xe(h, "hide_from_list", "Hide from lists")}`
    )}
      ${M("Places", o`${Ke(h, "address", "Address")} ${Ke(h, "school", "School")}`)}
      ${M(
      "Links",
      o`${fe(h, "website", "Website")} ${fe(h, "linkedin", "LinkedIn")} ${fe(h, "facebook", "Facebook")}
        ${fe(h, "instagram", "Instagram")}`
    )}
      ${M(
      "Notes and summary",
      o`${oe(h, "notes", "Notes", 2e4)} ${oe(h, "relationship_summary", "Relationship summary", 2e4)}`
    )}
      ${M("Household", mn(h, "household_id", "Household", rr(n, a.household_id)))}
      ${M("Groups", ar(t, i, n, a.group_ids))}
      <button class="btn" ?disabled=${u} @click=${() => void ir(t, s)}>Save</button>
      <button
        class="btn danger"
        style="margin-top:24px"
        ?disabled=${t.busy}
        @click=${() => t.drafts.put(Xe(e), r, {})}
      >
        Delete person
      </button>
    </div>`,
    overlay: t.drafts.get(Xe(e)) ? sr(t, s) : void 0
  };
}
const lr = (t, e) => `edit:relationship:${t}:${e ?? "new"}`, Qe = (t) => `confirm-delete:relationship:${t}`;
function cr(t, e, n) {
  const s = Hn(t, e, null), i = $(t), r = i.people.find((c) => c.id === e);
  if (!r) return s;
  let a, l = null;
  return n !== null && (a = i.relationships.find((c) => c.id === n), l = a ? Ie(a, e) : null, !a || !l) ? s : { ...s, overlay: dr(t, r, a ?? null, l) };
}
function dr(t, e, n, s) {
  const i = $(t), r = n?.id ?? null, a = lr(e.id, r), l = n ? p.relationship(e.id, n.id) : p.newRelationship(e.id), c = t.drafts.open(a, l, () => ({
    other: s?.otherId ?? "",
    type: s?.type ?? "",
    notes: n?.notes ?? ""
  })), h = i.people.find((v) => v.id === c.other), u = i.relationships.flatMap((v) => {
    const S = Ie(v, e.id);
    return S && S.otherId !== s?.otherId ? [S.otherId] : [];
  }), f = [{ value: "", label: "Choose…" }, ...i.connection_types.map((v) => ({ value: v, label: v }))];
  c.type && !i.connection_types.includes(c.type) && f.push({ value: c.type, label: c.type });
  const m = () => {
    t.drafts.drop(a), B(p.person(e.id));
  }, g = !!h && c.type !== "", w = async () => {
    const v = t.drafts.get(a), S = t.drafts.base(a);
    if (!v || !S || !v.other || !v.type) return;
    const Fn = v.other !== S.other || v.type !== S.type, bt = { person_a_id: e.id, person_b_id: v.other, type: v.type };
    (await t.save(
      "relationship",
      r,
      { ...bt, notes: v.notes },
      Fn ? { notes: S.notes } : { ...bt, notes: S.notes }
    ) || r && !$(t).relationships.some((jn) => jn.id === r)) && m();
  }, j = de(t, a), y = Pe(e.name);
  return o`<div class="sheet-backdrop" @click=${(v) => v.target === v.currentTarget && m()}>
    <div class="sheet" role="dialog" aria-label=${n ? "Edit relationship" : "Add relationship"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${m}>Cancel</button>
        <span class="title" style="text-align:center">${n ? "Relationship" : "Add relationship"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!g || t.busy} @click=${w}>
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
    onPick: (v) => t.drafts.patch(a, { other: v }),
    onRemove: () => t.drafts.patch(a, { other: "" }),
    disabled: t.busy
  })}
          <div class="muted" style="font-size:12.5px">${h ? h.name : "Someone"} is ${y}'s</div>
          ${mn(j, "type", "Type", f)} ${oe(j, "notes", "Notes", 2e4)}
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
  ${n && t.drafts.get(Qe(n.id)) ? hr(t, e, i.people.find((v) => v.id === s?.otherId), n, m) : d}`;
}
function hr(t, e, n, s, i) {
  const r = Qe(s.id), a = n?.name ?? "them";
  return N({
    title: `Remove the link between ${e.name} and ${a}?`,
    lines: ["Both people stay in Hearth. Only this relationship is removed. This can't be undone."],
    confirmLabel: "Remove",
    busy: t.busy,
    onCancel: () => t.drafts.drop(r),
    onConfirm: async () => {
      await t.remove("relationship", s.id) && (t.drafts.drop(r), i());
    }
  });
}
function Gt(t, e) {
  const n = t.contact_status, s = e ? "var(--danger)" : "var(--warning)";
  return o`<a class="row" href=${p.person(t.id)}>
    <span style="width:3px;height:36px;border-radius:2px;background:${s};flex:none"></span>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      <div class="sub">${n.last_contacted ? `Last: ${Ae(n.last_contacted)}` : "No interactions yet"}</div>
    </span>
    <span class="meta" style="color:${s}">${n.days_since_contact === null ? "—" : `${n.days_since_contact}d`}</span>
  </a>`;
}
const Bt = (t, e) => (t.contact_status.days_since_contact ?? 1 / 0) - (e.contact_status.days_since_contact ?? 1 / 0);
function ur(t) {
  const e = $(t).people.filter((i) => i.close_friend && !i.hide_from_list), n = e.filter((i) => i.contact_status.urgency === "overdue").sort(Bt), s = e.filter((i) => i.contact_status.urgency === "due_soon").sort(Bt);
  return {
    title: "Reach out",
    back: !1,
    actions: [],
    body: o`<div class="page">
      <div class="reach-card">
        <div class="mono accent" style="font-size:10px">CLOSE FRIEND ROTATION · ~6WK CADENCE</div>
        <div class="h-serif" style="font-size:17px;margin-top:6px">${Me(n.length, "person", "people")} overdue</div>
      </div>
      ${n.length ? o`<div class="label list-label">Overdue</div>
            <div class="list">${n.map((i) => Gt(i, !0))}</div>` : d}
      ${s.length ? o`<div class="label list-label">Due soon</div>
            <div class="list">${s.map((i) => Gt(i, !1))}</div>` : d}
      ${!n.length && !s.length ? o`<div class="empty">Everyone's been in touch recently.</div>` : d}
    </div>`
  };
}
const pr = [
  ["people", "People"],
  ["households", "Households"],
  ["groups", "Groups"]
], Ft = (t, e) => e === "" || t.toLocaleLowerCase().includes(e.toLocaleLowerCase());
function fr(t) {
  const e = I(t);
  return o`<a class="row" href=${p.household(t.id)}>
    ${E(e, t.photo_url)}
    <span class="main"><div class="name ${W(t) ? "" : "muted"}">${e}</div></span>
    <span class="meta">${Me(t.member_ids.length, "member")}</span>
  </a>`;
}
function mr(t) {
  return o`<a class="row" href=${p.group(t.id)}>
    ${E(t.name, t.photo_url)}
    <span class="main">
      <div class="name">${t.name}</div>
      ${t.description ? o`<div class="sub">${t.description}</div>` : d}
    </span>
    <span class="meta">${Me(t.member_ids.length, "member")}</span>
  </a>`;
}
function gr(t) {
  const { people: e, households: n, groups: s, relationships: i } = $(t), r = t.search.text.trim();
  switch (t.search.chip) {
    case "people": {
      const a = ft(r, e, i);
      return o`${a.direct.map((l) => Ve(l))}
      ${a.connected.length ? o`${Is("Connected")} ${a.connected.map((l) => Ve(l.person, l.reason))}` : d}
      ${a.direct.length + a.connected.length === 0 ? o`<div class="empty">No one matches “${r}”.</div>` : d}`;
    }
    case "households":
      return n.map((a) => ({ h: a, name: I(a) })).filter(({ name: a }) => Ft(a, r)).sort((a, l) => O(a.name, l.name)).map(({ h: a }) => fr(a));
    case "groups":
      return s.filter((a) => Ft(a.name, r)).sort((a, l) => O(a.name, l.name)).map(mr);
  }
}
function vr(t) {
  if (t === "people") return d;
  const [e, n] = t === "households" ? ["New household", p.newHousehold()] : ["New group", p.newGroup()];
  return o`<div style="padding:0 16px 8px"><a class="btn secondary new-record" style="display:inline-flex;align-items:center" href=${n}>${e}</a></div>`;
}
function yr(t) {
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
          .value=${C(e)}
          @input=${(s) => t.setSearch({ text: s.target.value })}
        />
      </div>
      <div class="pills" style="padding:8px 16px">
        ${pr.map(
      ([s, i]) => o`<button
            class="pill mono ${n === s ? "on" : ""}"
            aria-pressed=${n === s ? "true" : "false"}
            @click=${() => t.setSearch({ chip: s })}
          >
            ${i}
          </button>`
    )}
      </div>
      ${vr(n)}
      <div class="list">${gr(t)}</div>
    </div>`
  };
}
const br = new URL(import.meta.url).searchParams.get("v"), $r = 8, be = "me-picker";
function _r(t) {
  const { people: e, relationships: n, me_person_id: s } = $(t), i = s ? e.find((u) => u.id === s) : void 0, r = t.drafts.get(be)?.query ?? null, a = () => t.drafts.drop(be), l = async (u) => {
    await t.setMe(u) && a();
  }, c = o`<div style="display:flex;align-items:center;gap:12px">
    ${i ? o`${E(i.name, i.photo_url, 36)}<span style="flex:1;font-weight:600">${i.name}</span>` : o`<span class="muted" style="flex:1">Not set</span>`}
    ${r === null ? o`<button class="btn secondary" @click=${() => t.drafts.put(be, p.settings(), { query: "" })}>Change</button>
          ${i ? o`<button class="btn secondary" ?disabled=${t.busy} @click=${() => l(null)}>Clear</button>` : d}` : d}
  </div>`;
  if (r === null) return o`<div class="card" style="padding:13px">${c}</div>`;
  const h = ft(r.trim(), e, n).direct.slice(0, $r);
  return o`<div class="card" style="padding:13px;display:grid;gap:10px">
    ${c}
    <input
      id="me-search"
      class="input"
      type="search"
      placeholder="Search people"
      aria-label="Search people"
      autocomplete="off"
      .value=${C(r)}
      @input=${(u) => t.drafts.patch(be, { query: u.target.value })}
    />
    <div class="list">
      ${h.length ? h.map(
    (u) => o`<button class="row me-choice" style="width:100%;text-align:left" ?disabled=${t.busy} @click=${() => l(u.id)}>
              ${E(u.name, u.photo_url)}<span class="main"><div class="name">${u.name}</div></span>
            </button>`
  ) : o`<div class="empty">No one matches “${r.trim()}”.</div>`}
    </div>
    <button class="btn secondary" @click=${a}>Cancel</button>
  </div>`;
}
function xr(t) {
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
const Se = "confirm-import";
function wr(t, e) {
  return N({
    title: `Import ${e.name}?`,
    lines: ["Everything in your Hearth is replaced by what's in this file."],
    confirmLabel: "Import",
    busy: t.busy,
    onCancel: () => t.drafts.drop(Se),
    onConfirm: () => {
      t.drafts.drop(Se), t.importBundle(e, !1);
    }
  });
}
function kr(t) {
  const e = t.importState, n = e.kind === "uploading", s = (i) => {
    const r = i.target, a = r.files?.[0];
    r.value = "", a && t.drafts.put(Se, p.settings(), { file: a });
  };
  return o`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">Replaces everything in your Hearth with a Hearth export (.zip).</div>
    <input
      id="import-file"
      type="file"
      accept=".zip,application/zip"
      aria-label="Choose a Hearth export to import"
      ?disabled=${t.busy}
      @change=${s}
    />
    ${n ? o`<div class="notice" role="status" style="margin:0">Uploading and importing…</div>` : d}
    ${e.kind === "done" ? o`<div class="notice" role="status" style="margin:0">${e.summary}</div>` : d}
    ${e.kind === "refused" ? o`<div role="alert" style="display:grid;gap:8px">
          <div>${xr(e)}</div>
          ${e.reason === "invalid" && e.problems.length ? o`<ul class="muted" style="margin:0;padding-left:18px;font-size:12.5px">
                ${e.problems.map((i) => o`<li>${i}</li>`)}
              </ul>` : d}
          ${e.reason === "local_changes" ? o`<div class="actions" style="display:flex;gap:8px">
                <button class="btn secondary" ?disabled=${t.busy} @click=${() => t.clearImport()}>Cancel</button>
                <button class="btn danger" ?disabled=${t.busy} @click=${() => void t.importBundle(e.file, !0)}>Replace everything</button>
              </div>` : d}
        </div>` : d}
  </div>`;
}
function Cr(t) {
  const e = t.drafts.get(Se);
  return {
    overlay: e ? wr(t, e.file) : Vi(t),
    title: "Settings",
    back: !0,
    actions: [],
    body: o`<div class="page">
      <div class="label" style="padding:16px 20px 8px">This is me</div>
      ${_r(t)}

      <div class="label" style="padding:0 20px 8px">Export</div>
      <div class="card" style="padding:13px;display:grid;gap:10px">
        <div class="muted" style="font-size:12.5px">Saves everything in your Hearth as one file in your Hearth exports folder.</div>
        <button class="btn" ?disabled=${t.busy} @click=${() => void t.exportNow()}>Export now</button>
      </div>

      <div class="label" style="padding:0 20px 8px">Import</div>
      ${kr(t)}

      <div class="label" style="padding:0 20px 8px">Google Contacts</div>
      ${ji(t)}

      <div class="label" style="padding:0 20px 8px">About</div>
      <div class="card" style="padding:13px">Version ${br ?? "unknown"}</div>
    </div>`
  };
}
const Er = "https://claude.ai/new", Ar = "Offline. Showing what was last loaded; changes are paused.";
function Sr(t, e) {
  switch (e.name) {
    case "home":
      return Ys(t);
    case "search":
      return yr(t);
    case "reachOut":
      return ur(t);
    case "add":
      return Ls(t);
    case "birthdays":
      return Ws(t);
    case "interactions":
      return Zs(t);
    case "settings":
      return Cr(t);
    case "person":
      return Hn(t, e.id, e.sheet);
    case "personEdit":
      return or(t, e.id);
    case "relationship":
      return cr(t, e.personId, e.relId);
    case "household":
      return Si(t, e.id);
    case "householdNew":
      return bi(t);
    case "householdEdit":
      return Ai(t, e.id);
    case "group":
      return Ti(t, e.id);
    case "groupNew":
      return fi(t);
    case "groupEdit":
      return vi(t, e.id);
    case "interaction":
      return ni(t, e.id, e.sheet);
  }
}
const jt = [
  { tab: "home", href: p.home(), icon: b.home, label: "Home" },
  { tab: "search", href: p.search(), icon: b.search, label: "Search" },
  { tab: "reachOut", href: p.reachOut(), icon: b.bell, label: "Reach out" },
  { tab: "add", href: p.add(), icon: b.plusCircle, label: "Add" }
];
function Tr(t) {
  const e = (n) => o`<a href=${n.href} class=${t === n.tab ? "active" : ""} aria-label=${n.label} title=${n.label}
      aria-current=${t === n.tab ? "page" : "false"}>${n.icon}</a>`;
  return o`<nav class="tabbar">
    ${jt.slice(0, 2).map(e)}
    <a href=${Er} target="_blank" rel="noopener noreferrer" aria-label="Talk to Claude" title="Talk to Claude">${b.mic}</a>
    ${jt.slice(2).map(e)}
  </nav>`;
}
function Ln() {
  return o`<button class="icon-btn" aria-label="Menu" title="Menu" @click=${(e) => e.currentTarget.dispatchEvent(new Event("hass-toggle-menu", { bubbles: !0, composed: !0 }))}>${b.menu}</button>`;
}
function Un(t) {
  return t ? o`<div class="toast" role="status">${t}</div>` : d;
}
function Rr(t, e) {
  const n = e.narrow || t.back || t.title || t.actions.length;
  return o`<div class="shell">
    ${n ? o`<header class="topbar">
          ${e.narrow ? Ln() : d}
          ${t.back ? o`<button class="icon-btn" aria-label="Back" title="Back" @click=${() => B(p.home())}>
                ${b.back}
              </button>` : d}
          <span class="title">${t.title ?? ""}</span>
          ${t.actions.map(Ns)}
          <button class="icon-btn muted" aria-label="Refresh" title="Refresh" ?disabled=${e.refreshing} @click=${e.onRefresh}>
            ${b.refresh}
          </button>
        </header>` : d}
    <main class="content" id="content">
      ${e.store.offline ? o`<div class="notice" role="status">${Ar}</div>` : d} ${t.body}
    </main>
    ${Tr(e.lastTab)} ${t.overlay ?? d} ${Un(e.toast)}
  </div>`;
}
function q(t, e) {
  return o`<div class="shell">
    ${e.narrow ? o`<header class="topbar">${Ln()}<span class="title">Hearth</span></header>` : d}
    <main class="content status">${t}</main>
    ${Un(e.toast)}
  </div>`;
}
const Vt = (t) => t.length > 1 ? t.replace(/\/+$/, "") : t;
function Mr(t, e) {
  const n = Vt(t), s = Vt(e);
  return n === s || n.startsWith(`${s}/`);
}
class Pr {
  /** `onChange` is called after every change made by a user action (put, patch, drop). */
  constructor(e = () => {
  }) {
    this.onChange = e, this.entries = /* @__PURE__ */ new Map();
  }
  /**
   * The draft under `key`, started from `init()` when there is none. Screens call this while
   * drawing, so it doesn't call onChange. `path` is the form's path (an `href.*` value).
   */
  open(e, n, s) {
    const i = this.entries.get(e);
    if (i) return i.value;
    const r = s();
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
  put(e, n, s) {
    this.entries.set(e, { path: n, value: s, base: { ...s } }), this.onChange();
  }
  /** Merges into the stored draft, not a render's copy: several inputs can land before a re-render. */
  patch(e, n) {
    const s = this.entries.get(e);
    s && (this.entries.set(e, { ...s, value: { ...s.value, ...n } }), this.onChange());
  }
  drop(e) {
    this.entries.delete(e) && this.onChange();
  }
  /** The route is now `path`: every draft whose form path it isn't on is dropped. Called before drawing. */
  leaveTo(e) {
    for (const [n, s] of this.entries) Mr(e, s.path) || this.entries.delete(n);
  }
}
const Nr = {
  person: ["address", "school"],
  household: ["address"]
}, Dn = (t, e) => Nr[t]?.includes(e) ?? !1;
function zn(t, e) {
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
  return zn(t, e).find((s) => s.id === n);
}
function Ir(t, e) {
  return ["person", "household", "contact_group", "relationship", "interaction"].some((s) => zn(t, s).some((i) => i.id === e));
}
const et = (t, e) => t === e || typeof t == "object" && typeof e == "object" && JSON.stringify(t) === JSON.stringify(e);
function tt(t, e, n) {
  if (typeof n != "string") return n;
  const s = n.trim();
  return Dn(t, e) ? s ? { formatted: s } : null : s || null;
}
function Kt(t, e) {
  return e ? Object.fromEntries(Object.entries(t).filter(([n, s]) => !(n in e) || !et(s, e[n]))) : t;
}
function Yt(t, e, n) {
  const s = {};
  for (const [i, r] of Object.entries(n)) {
    if (r === void 0) continue;
    const a = e[i] ?? null;
    if (Dn(t, i) && typeof r == "string") {
      const c = (a?.formatted ?? "").trim();
      r.trim() !== c && (s[i] = tt(t, i, r));
      continue;
    }
    if (et(r, a)) continue;
    const l = tt(t, i, r);
    et(l, a) || (s[i] = l);
  }
  return s;
}
function Hr(t, e) {
  const n = {};
  for (const [s, i] of Object.entries(e)) {
    const r = tt(t, s, i);
    r != null && (n[s] = r);
  }
  return n;
}
const Gn = "You're offline. Changes are paused.", Be = "Still saving…", nt = "That was already deleted.", Wt = "hearth_crm:snapshot:", Or = 250, Lr = 3500, Zt = [2e3, 5e3, 1e4], Ur = 1e4;
class Dr {
  constructor(e, n, s, i, r) {
    this.api = e, this.conn = n, this.userId = s, this.storage = i, this.onChange = r, this.phase = { kind: "loading" }, this.snapshot = null, this.entryId = null, this.offline = !1, this.lastError = null, this.createError = null, this.creating = !1, this.retrying = !1, this.search = { text: "", chip: "people" }, this.drafts = new Pr(() => this.onChange()), this.busy = !1, this.shrinkingPhoto = !1, this.importState = { kind: "idle" }, this.google = { status: null, loadError: null, preview: null, lastSync: null, working: null }, this.toast = null, this.writeError = null, this.subscription = null, this.connEpoch = 0, this.timer = null, this.retryTimer = null, this.retryAttempt = 0, this.generation = 0, this.stopped = !1, this.startRun = null, this.retryRun = null, this.toastTimer = null, this.fetchSeq = 0, this.arriving = null, this.pendingMembers = /* @__PURE__ */ new Map(), this.arrivingTimer = null, this.pendingFavorites = /* @__PURE__ */ new Map(), this.onSettings = !1, this.onDisconnected = () => {
      this.connEpoch++, this.subscription = null, this.offline = !0, this.onChange();
    }, this.onReady = () => {
      this.connEpoch++, this.retryAttempt = 0, this.load();
    }, this.onVisibilityChange = () => {
      document.visibilityState !== "visible" || this.offline || !this.snapshot || zr(/* @__PURE__ */ new Date()) !== this.snapshot.today && this.refresh();
    };
  }
  get cacheKey() {
    return `${Wt}${this.userId}`;
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
        this.createError = z(e);
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
    this.drafts.leaveTo(e), this.writeError = null, this.onSettings = e === `${_}/settings`, this.onSettings && this.phase.kind === "ready" && this.loadGoogle(), this.importState.kind === "refused" && e !== `${_}/settings` && (this.importState = { kind: "idle" });
  }
  showToast(e) {
    this.toastTimer && clearTimeout(this.toastTimer), this.toast = e, this.onChange(), this.toastTimer = setTimeout(() => {
      this.toastTimer = null, this.toast = null, this.onChange();
    }, Lr);
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
    } catch (s) {
      this.pendingFavorites.delete(e.id), this.patchFavorite(e.id, e.favorite), this.showToast($e(s));
    }
  }
  async addInteraction(e) {
    const { person_ids: n, type: s, date: i, summary: r, notes: a } = e;
    return await this.write(() => this.api.create("interaction", { person_ids: n, type: s, date: i, summary: r, notes: a })) !== null;
  }
  /**
   * Changes the interaction's own fields only, so the people on a shared one are kept. Only the
   * fields that differ from `base` (what the sheet opened with) and from the snapshot are sent, so
   * an imported summary over the edit limit doesn't block changing just the date. One deleted
   * elsewhere counts as done (with the deleted toast), so its sheet closes.
   */
  async updateInteraction(e, n, s) {
    const { type: i, date: r, summary: a, notes: l } = n, c = Kt({ type: i, date: r, summary: a, notes: l }, s ? { ...s } : void 0), h = this.snapshot ? qt(this.snapshot, "interaction", e) : void 0, u = h ? Yt("interaction", h, c) : c;
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
    return e.birthday?.trim() && (n.birthday = e.birthday, e.birth_year_unknown && (n.birth_year_unknown = !0)), (await this.save("person", null, n))?.id ?? null;
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
  async save(e, n, s, i) {
    if (n === null) {
      const c = await this.write(() => this.api.create(e, Hr(e, s)));
      return c ? (this.markArriving(c.value.id), { id: c.value.id }) : null;
    }
    const r = this.snapshot ? qt(this.snapshot, e, n) : void 0;
    if (!r)
      return this.refuseOffline() || this.showToast(nt), null;
    const a = Yt(e, r, Kt(s, i));
    return Object.keys(a).length ? (await this.write(async () => (await this.api.update(e, n, a), !0), { ifGone: () => !1 }))?.value ? { id: n } : null : { id: n };
  }
  /** Deletes a record. One already deleted elsewhere counts as done, with the deleted toast. */
  async remove(e, n) {
    return await this.write(() => this.api.remove(e, n), { ifGone: () => {
    } }) !== null;
  }
  /** `base64` is the shrunk photo (forms/photoPicker.ts). */
  async setPhoto(e, n, s) {
    return await this.write(() => this.api.setPhoto(e, n, s)) !== null;
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
    const s = await this.write(async () => (await this.api.setGroupMembers(e, n), !0), {
      ifGone: () => !1
    });
    return s ? s.value ? (this.pendingMembers.set(e, { ids: [...n], afterSeq: this.fetchSeq }), this.snapshot && (this.snapshot = this.withPendingMembers(this.snapshot)), this.onChange(), !0) : (this.pendingMembers.delete(e), !1) : !1;
  }
  /** The group's members to build a membership write on: the last list sent, until a snapshot has it. */
  groupMembers(e) {
    const n = this.pendingMembers.get(e);
    return n ? [...n.ids] : [...this.snapshot?.groups.find((s) => s.id === e)?.member_ids ?? []];
  }
  withPendingMembers(e) {
    return this.pendingMembers.size ? {
      ...e,
      groups: e.groups.map((n) => {
        const s = this.pendingMembers.get(n.id);
        return s ? { ...n, member_ids: [...s.ids] } : n;
      })
    } : e;
  }
  /** Pending member lists end once a snapshot has them, or a fetch started after the write lands. */
  settlePendingMembers(e, n) {
    const s = (i, r) => i.length === r.length && i.every((a) => r.includes(a));
    for (const [i, r] of this.pendingMembers) {
      const a = e.groups.find((l) => l.id === i);
      (n > r.afterSeq || !a || s(a.member_ids, r.ids)) && this.pendingMembers.delete(i);
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
    }, Ur), this.onChange();
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
    const { path: s } = n.value, i = s.split(/[\\/]/).pop() || s;
    return this.showToast(`Saved ${i} to your Hearth exports folder.`), !0;
  }
  /**
   * Uploads a bundle into this user's Hearth. The result is in `importState`: the summary, or a
   * refusal the Settings card explains. A backup in progress is a toast, like any write; the
   * snapshot refetches by itself from the server's change notice.
   */
  async importBundle(e, n) {
    if (this.refuseOffline()) return !1;
    if (this.busy)
      return this.showToast(Be), !1;
    this.busy = !0, this.importState = { kind: "uploading" }, this.onChange();
    try {
      const s = await this.api.importBundle(e, n);
      return this.importState = { kind: "done", summary: s.summary }, !0;
    } catch (s) {
      const i = s instanceof A ? s : null, r = i?.code ?? "unknown_error";
      return r === "local_changes" || r === "cutover_confirmed" || r === "invalid" || r === "too_large" || r === "bad_request" || r === "no_crm" ? this.importState = { kind: "refused", reason: r, message: i?.message ?? r, problems: i?.problems ?? [], file: e } : (this.importState = { kind: "idle" }, this.showToast($e(s, "Couldn't import"))), !1;
    } finally {
      this.busy = !1, this.onChange();
    }
  }
  clearImport() {
    this.importState = { kind: "idle" }, this.onChange();
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
      n instanceof A && n.code === "offline" ? this.offline = !0 : this.google = { ...this.google, loadError: z(n) };
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
  async runGoogle(e, n, s) {
    if (this.refuseOffline()) return !1;
    if (this.busy || this.google.working)
      return this.showToast(Be), !1;
    this.google = { ...this.google, working: e }, this.onChange();
    const i = this.generation;
    let r = null;
    try {
      r = await n();
    } catch (a) {
      if (i !== this.generation) return !1;
      this.showToast($e(a, s));
    }
    return i !== this.generation || (this.google = e === "preview" ? { ...this.google, working: null, preview: r ?? this.google.preview } : { ...this.google, working: null, lastSync: r ?? this.google.lastSync, preview: r ? null : this.google.preview }, this.onChange(), await this.loadGoogle()), r !== null;
  }
  /** Forgets a person's Google link so the next run creates a new contact. */
  async clearGoogleContact(e) {
    return await this.write(() => this.api.googleClearContact(e), { ifGone: () => {
    } }) ? (await this.loadGoogle(), !0) : !1;
  }
  refuseOffline() {
    return this.offline ? (this.showToast(Gn), !0) : !1;
  }
  /** Runs one write at a time. Resolves to null, with a toast, when refused or failed. */
  async write(e, n = {}) {
    if (this.refuseOffline()) return null;
    if (this.busy)
      return this.showToast(Be), null;
    this.busy = !0, this.writeError = null, this.onChange();
    try {
      return { value: await e() };
    } catch (s) {
      const i = s instanceof A ? s : null;
      return n.ifGone && i?.code === "not_found" ? (this.showToast(nt), await this.refresh(), { value: n.ifGone() }) : (this.writeError = i, this.showToast($e(s, n.failure)), null);
    } finally {
      this.busy = !1, this.onChange();
    }
  }
  patchFavorite(e, n) {
    this.snapshot && (this.snapshot = {
      ...this.snapshot,
      people: this.snapshot.people.map((s) => s.id === e ? { ...s, favorite: n } : s)
    });
  }
  /** Re-fetch the snapshot now. Failures keep the data already shown. */
  async refresh() {
    const e = this.generation;
    try {
      const n = ++this.fetchSeq, s = await this.api.snapshot();
      if (e !== this.generation) return;
      this.accept(s, n);
    } catch (n) {
      if (e !== this.generation) return;
      const s = n instanceof A ? n : null;
      if (s?.code === "offline")
        this.offline = !0;
      else if (s?.code === "no_crm" || s?.code === "crm_not_loaded") {
        await this.load();
        return;
      } else {
        this.lastError = s ?? new A("unknown_error", z(n)), this.showToast(`Couldn't refresh: ${this.lastError.message}`);
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
      const s = this.connEpoch, i = await this.api.subscribe((l) => this.onNotice(l));
      if (e !== this.generation) {
        s === this.connEpoch && i().catch(() => {
        });
        return;
      }
      this.subscription = { unsubscribe: i, epoch: s };
      const r = ++this.fetchSeq, a = await this.api.snapshot();
      if (e !== this.generation) return;
      this.accept(a, r), this.phase = { kind: "ready" }, this.retryAttempt = 0, this.onChange(), this.onSettings && this.loadGoogle();
    } catch (n) {
      if (e !== this.generation) return;
      this.fail(n);
    }
  }
  show(e) {
    this.phase = e, this.snapshot = null, this.offline = !1, this.onChange();
  }
  fail(e) {
    this.snapshot || (this.snapshot = this.readCache()), this.snapshot ? (this.offline = !0, this.phase = { kind: "ready" }, this.scheduleRetry()) : this.phase = { kind: "error", message: z(e) }, this.onChange();
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
    const s = this.arriving;
    s && (n > s.afterSeq || Ir(e, s.id)) && this.stopArriving();
    const i = this.pendingFavorites.size ? {
      ...e,
      people: e.people.map(
        (r) => this.pendingFavorites.has(r.id) ? { ...r, favorite: this.pendingFavorites.get(r.id) } : r
      )
    } : e;
    this.settlePendingMembers(e, n), this.snapshot = this.withPendingMembers(i), this.offline = !1, this.lastError = null;
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
      for (let s = 0; s < e.length; s++) {
        const i = e.key(s);
        i?.startsWith(Wt) && i !== this.cacheKey && n.push(i);
      }
      for (const s of n) e.removeItem(s);
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
    this.scheduleRefresh(), e?.entity === "google" && this.google.status && this.loadGoogle();
  }
  scheduleRefresh() {
    this.stopped || (this.timer && clearTimeout(this.timer), this.timer = setTimeout(() => {
      this.timer = null, this.refresh();
    }, Or));
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
function zr(t) {
  const e = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${e(t.getMonth() + 1)}-${e(t.getDate())}`;
}
function $e(t, e = "Couldn't save") {
  switch (t instanceof A ? t.code : null) {
    case "offline":
      return Gn;
    case "backup_in_progress":
      return "Home Assistant is making a backup. Try again in a moment.";
    case "invalid":
      return z(t);
    case "not_found":
      return nt;
    case "import_failed":
    case "cutover_not_confirmed":
    case "sync_refused":
    case "sync_failed":
    case "not_blocked":
      return z(t);
    default:
      return `${e}: ${z(t)}`;
  }
}
function z(t) {
  return t instanceof Error ? t.message : String(t);
}
const Gr = ':host{--bg: var(--primary-background-color, #fafafa);--surface: var(--card-background-color, var(--ha-card-background, #ffffff));--text: var(--primary-text-color, #212121);--text-2: var(--secondary-text-color, #727272);--border: var(--divider-color, rgba(0, 0, 0, .12));--accent: var(--primary-color, #03a9f4);--on-accent: var(--text-primary-color, #ffffff);--accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);--hover: color-mix(in srgb, var(--text) 6%, transparent);--thread: var(--divider-color, rgba(0, 0, 0, .12));--danger: var(--error-color, #db4437);--warning: var(--warning-color, #ffa600);--scrim: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, .32));--sans: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif));--serif: var(--sans);--mono: var(--ha-font-family-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace);--tabbar: 56px;display:flex;flex-direction:column;height:100dvh;box-sizing:border-box;padding:var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) var(--safe-area-content-inset-right, var(--safe-area-inset-right, env(safe-area-inset-right, 0px))) 0 var(--safe-area-content-inset-left, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));background:var(--bg);color:var(--text);font:14px/1.4 var(--sans);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}*{box-sizing:border-box}button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}a{color:inherit;text-decoration:none}input,textarea{font:inherit;color:var(--text)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.shell{display:flex;flex-direction:column;flex:1;min-height:0}.topbar{display:flex;align-items:center;gap:4px;min-height:48px;padding:0 8px;border-bottom:1px solid var(--border);background:var(--bg);flex:none}.topbar .title{flex:1;font:600 16px var(--serif);padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.icon-btn{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;border-radius:10px;color:var(--text)}.icon-btn:hover{background:var(--hover)}.icon-btn.accent{color:var(--accent)}.icon-btn.muted{color:var(--text-2)}.icon-btn[disabled]{opacity:.4;cursor:default}.icon-btn svg{width:20px;height:20px}.content{flex:1;overflow-y:auto;overscroll-behavior:contain;padding-bottom:24px;position:relative}.content.status{padding-bottom:calc(24px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.page{max-width:640px;margin:0 auto}.tabbar{flex:none;display:flex;height:calc(var(--tabbar) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));padding-bottom:var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));border-top:1px solid var(--border);background:var(--bg)}.tabbar a,.tabbar button{flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-2)}.tabbar .active{color:var(--accent)}.tabbar svg{width:22px;height:22px}.h-serif{font-family:var(--serif);font-weight:600}.mono{font-family:var(--mono)}.label{font:500 10.5px var(--mono);color:var(--text-2);letter-spacing:.02em;text-transform:uppercase}.muted{color:var(--text-2)}.accent{color:var(--accent)}.danger{color:var(--danger)}.warning{color:var(--warning)}.section{margin:16px 0 0}.section-head{display:flex;align-items:baseline;justify-content:space-between;padding:0 16px 6px}.section-head h2{margin:0;font:600 17px var(--serif)}.section-head a,.section-head button{font:600 12px var(--sans);color:var(--accent)}.list{background:var(--surface)}.row{display:flex;align-items:center;gap:12px;padding:8px 16px;min-height:56px;border-bottom:1px solid var(--border);width:100%;text-align:left}.row:last-child{border-bottom:0}.row:hover{background:var(--hover)}.row .main{flex:1;min-width:0}.row .name{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .sub{font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .meta{font:500 10.5px var(--mono);color:var(--text-2);flex:none}.row .star{color:var(--accent);display:inline-block;width:10px;height:10px;margin-left:6px;vertical-align:1px}svg{display:block;width:100%;height:100%}.list-label{padding:10px 16px 4px}.empty{padding:24px 16px;color:var(--text-2);text-align:center}.avatar{flex:none;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-family:var(--serif);font-weight:600;position:relative}.avatar img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}.avatar img.broken{display:none}.stack{display:inline-flex;flex:none}.stack .avatar{box-shadow:0 0 0 2px var(--surface)}.card{background:var(--surface);border-radius:14px;margin:0 16px 18px;padding:10px 13px}.reach-card{margin:16px;padding:16px;border-radius:16px;background:var(--surface);border:1px solid var(--border)}.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--thread);border-radius:999px;font-size:10.5px;color:var(--accent)}.chips{display:flex;flex-wrap:wrap;gap:6px}.pills{display:flex;gap:7px;overflow-x:auto;padding:4px 0}.pill{flex:none;min-height:36px;padding:6px 14px;border-radius:999px;background:var(--surface);color:var(--text-2);font:500 11.5px var(--sans)}.pill.on{background:var(--accent);color:var(--on-accent)}.pill.mono{font:500 11px var(--mono)}.pill.mono.on{background:var(--text);color:var(--bg)}.form{padding:8px 16px;display:grid;gap:16px}.field{display:grid;gap:6px}.field>span{font:500 10.5px var(--mono);color:var(--text-2);text-transform:uppercase}.input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 12px;font-size:15px}.input:focus{border-color:var(--accent);outline:none}textarea.input{min-height:110px;resize:vertical}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px;accent-color:var(--accent)}.btn{min-height:44px;padding:0 18px;border-radius:12px;background:var(--accent);color:var(--on-accent);font-weight:600}.btn[disabled]{opacity:.4;cursor:default}.btn.danger{background:var(--danger);color:var(--on-accent)}.btn.secondary{background:var(--surface);color:var(--text);border:1px solid var(--thread)}.highlight .input{border-color:var(--warning);box-shadow:0 0 0 1px var(--warning)}.field-error{color:var(--danger);font-size:12px}.input[aria-invalid=true]{border-color:var(--danger)}select.input{appearance:auto}.chip-remove{margin-left:2px;min-width:24px;min-height:24px;color:var(--text-2);font-size:14px}.person-picker .chip{color:var(--text)}.photo-picker{display:grid;justify-items:center;gap:10px;padding:8px 0}.photo-picker .actions{display:flex;gap:8px}.file-btn{display:inline-flex;align-items:center;cursor:pointer;position:relative}.file-btn[aria-disabled=true]{opacity:.4;cursor:default}.file-btn:focus-within{outline:2px solid var(--accent);outline-offset:2px}.photo-tap{border-radius:50%}.file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.banner{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--danger);color:var(--on-accent);font:500 11px var(--mono)}.notice{margin:8px 16px;padding:8px 12px;border-radius:12px;background:var(--accent-soft);color:var(--text);font:500 11px var(--mono)}.center{min-height:60vh;display:grid;place-items:center;text-align:center;padding:24px}.spinner{width:22px;height:22px;border:2px solid var(--thread);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px}@keyframes spin{to{transform:rotate(360deg)}}.sheet-backdrop{position:fixed;inset:0;background:var(--scrim);display:flex;align-items:flex-end;justify-content:center;z-index:10}.sheet{background:var(--bg);width:100%;max-width:640px;max-height:94%;border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden}.sheet .sheet-body{overflow-y:auto;padding-bottom:calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))}.dialog{background:var(--surface);border-radius:16px;padding:20px;margin:auto 16px;max-width:360px;width:100%;display:grid;gap:14px;text-align:center}.dialog .actions{display:flex;gap:8px;justify-content:center}.toast{position:fixed;left:50%;transform:translate(-50%);bottom:calc(var(--tabbar) + 16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));background:var(--surface);color:var(--text);border:1px solid var(--border);padding:10px 16px;border-radius:12px;z-index:20;font-size:13px;box-shadow:0 2px 8px var(--scrim)}.actions-row{display:flex;gap:8px;padding:0 20px 18px}.action{width:54px;height:38px;border-radius:12px;background:var(--surface);color:var(--text);display:inline-flex;align-items:center;justify-content:center}.action svg{width:17px;height:17px}.action.primary{background:var(--accent);color:var(--on-accent)}';
function Jt() {
  return o`<div class="center"><div class="spinner" role="progressbar" aria-label="Loading"></div></div>`;
}
function Br(t) {
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
function Fr(t) {
  return o`<div class="center">
    <div style="max-width:420px">
      <p>Your Hearth didn't load. Check Settings → Devices &amp; services → Hearth.</p>
      ${Bn(t)}
    </div>
  </div>`;
}
function Bn(t) {
  return o`<button class="btn" ?disabled=${t.retrying} aria-busy=${t.retrying ? "true" : "false"} @click=${() => void t.retry()}>
    ${t.retrying ? "Retrying…" : "Retry"}
  </button>`;
}
function jr(t, e) {
  return o`<div class="center">
    <div style="max-width:420px">
      <p>${e}</p>
      ${Bn(t)}
    </div>
  </div>`;
}
function Vr(t) {
  const e = t instanceof Error ? `${t.name}: ${t.message}` : String(t);
  return o`<div class="center">
    <div style="max-width:460px">
      <div class="h-serif" style="font-size:19px;margin-bottom:12px">Hearth hit a problem</div>
      <pre class="mono danger" style="white-space:pre-wrap;font-size:11px;text-align:left">${e}</pre>
      <button class="btn" @click=${() => location.reload()}>Reload</button>
    </div>
  </div>`;
}
var qr = Object.defineProperty, ue = (t, e, n, s) => {
  for (var i = void 0, r = t.length - 1, a; r >= 0; r--)
    (a = t[r]) && (i = a(e, n, i) || i);
  return i && qr(e, n, i), i;
};
function Kr(t, e) {
  return t?.user?.id !== e?.user?.id || t?.connection !== e?.connection;
}
function Yr(t, e) {
  return t?.path !== e?.path || t?.prefix !== e?.prefix;
}
function Wr() {
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
      const n = e.composedPath().find((i) => i.localName === "a");
      if (!n || n.hasAttribute("target") || n.hasAttribute("download")) return;
      const s = n.getAttribute("href");
      !s || !$s(s) || (e.preventDefault(), s !== `${location.pathname}${location.search}` && L(s));
    };
  }
  static {
    this.styles = Qt(Gr);
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
    return ys(this.route?.path ?? "");
  }
  willUpdate(e) {
    if (this.syncStore(), e.has("route")) {
      const n = e.get("route"), s = this.renderRoot.querySelector("#content");
      n && s && this.scrollPositions.set(n.path, s.scrollTop), this.lastTab = _s(this.currentRoute) ?? this.lastTab, this.store?.routeChanged(`${_}${this.route?.path ?? ""}`);
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
    const n = new Dr(
      new vs(this.hass.connection, () => this.hass?.auth),
      this.hass.connection,
      e,
      Wr(),
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
      const s = e.phase;
      switch (s.kind) {
        case "loading":
          return q(Jt(), n);
        case "noCrm":
          return q(Br(e), n);
        case "notLoaded":
          return q(Fr(e), n);
        case "error":
          return q(jr(e, s.message), n);
        case "ready": {
          const i = { ...n, store: e, lastTab: this.lastTab, refreshing: this.refreshing, onRefresh: this.onRefresh };
          return Rr(Sr(e, this.currentRoute), i);
        }
      }
    } catch (s) {
      return console.error(s), q(Vr(s), n);
    }
  }
}
ue([
  ce({ attribute: !1, hasChanged: Kr })
], X.prototype, "hass");
ue([
  ce({ type: Boolean })
], X.prototype, "narrow");
ue([
  ce({ attribute: !1, hasChanged: Yr })
], X.prototype, "route");
ue([
  ce({ attribute: !1 })
], X.prototype, "panel");
ue([
  fs()
], X.prototype, "refreshing");
customElements.get("hearth-panel") || customElements.define("hearth-panel", X);
export {
  X as HearthPanel,
  br as PANEL_VERSION,
  Kr as hassChanged
};
