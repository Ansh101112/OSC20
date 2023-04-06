// @ts-check
import { customElement, property, query } from 'lit/decorators.js';
import {LitElement, html} from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { ModeSmoothZoom } from './ModeSmoothZoom';
import { arrChanged, calcScreenDPI, genToArray, promisifyEvent, sleep, throttle } from './utils';
import { HTMLDimensionsCacher } from "./utils/HTMLDimensionsCacher";
/** @typedef {import('./BookModel').BookModel} BookModel */
/** @typedef {import('./BookModel').PageIndex} PageIndex */
/** @typedef {import('./BookModel').PageModel} PageModel */
/** @typedef {import('./ModeSmoothZoom').SmoothZoomable} SmoothZoomable */
/** @typedef {import('./PageContainer').PageContainer} PageContainer */
/** @typedef {import('../BookReader').default} BookReader */

// I _have_ to make this globally public, otherwise it won't let me call
// it's constructor :/
/** @implements {SmoothZoomable} */
@customElement('br-mode-2up')
export class Mode2UpLit extends LitElement {
  /****************************************/
  /************** PROPERTIES **************/
  /****************************************/

  /** @type {BookReader} */
  br;

  /************** BOOK-RELATED PROPERTIES **************/

  /** @type {BookModel} */
  @property({ type: Object })
  book;

  /** @type {PageModel[]} */
  @property({ type: Array })
  pages = [];

  /************** SCALE-RELATED PROPERTIES **************/

  /** @private */
  screenDPI = calcScreenDPI();

  /**
   * How much smaller the rendered pages are than the real-world item
   *
   * Mode1Up doesn't use the br.reduce because it is DPI aware. The reduction factor
   * of a given leaf can change (since leaves can have different DPIs), but the real-world
   * reduction is constant throughout.
   */
  realWorldReduce = 1;

  @property({ type: Number })
  scale = 1;
  /** Position (in unit-less, [0, 1] coordinates) in client to scale around */
  @property({ type: Object })
  scaleCenter = { x: 0.5, y: 0.5 };

  /************** VIRTUAL-SCROLLING PROPERTIES **************/

  /** @type {PageModel[]} */
  @property({ type: Array, hasChanged: arrChanged })
  visiblePages = [];

  get pageLeft() {
    return this.visiblePages.find(p => p.pageSide == 'L');
  }

  get pageRight() {
    return this.visiblePages.find(p => p.pageSide == 'R');
  }

  /** @type {PageModel[]} */
  @property({ type: Array })
  renderedPages = [];

  /** @type {Record<PageIndex, PageContainer>} position in inches */
  pageContainerCache = {};

  /************** DOM-RELATED PROPERTIES **************/

  /** @type {HTMLElement} */
  get $container() { return this; }

  /** @type {HTMLElement} */
  get $visibleWorld() { return this.$book; }

  /** @type {HTMLElement} */
  @query('.br-mode-2up__book')
  $book;

  get positions() {
    return this.computePositions(this.pageLeft, this.pageRight);
  }

  /**
   * @param {PageModel} pageLeft
   * @param {PageModel} pageRight
   */
  computePositions(pageLeft, pageRight) {
    const leafEdgesLeftStart = 0;
    const leafEdgesLeftWidth = Math.ceil(pageLeft.index / 2) * this.PAGE_THICKNESS_IN;
    const leafEdgesLeftEnd = leafEdgesLeftStart + leafEdgesLeftWidth;
    const pageLeftStart = leafEdgesLeftEnd;
    const pageLeftEnd = pageLeftStart + pageLeft.widthInches;
    const gutter = pageLeftEnd;
    const pageRightStart = gutter;
    const pageRightEnd = pageRightStart + pageRight.widthInches;
    const leafEdgesRightStart = pageRightEnd;
    const leafEdgesRightWidth = Math.ceil((this.book.getNumLeafs() - pageRight.index) / 2) * this.PAGE_THICKNESS_IN;
    const leafEdgesRightEnd = leafEdgesRightStart + leafEdgesRightWidth;
    const bookWidth = leafEdgesRightEnd;
    return {
      leafEdgesLeftStart,
      leafEdgesLeftWidth,
      leafEdgesLeftEnd,
      pageLeftStart,
      pageLeftEnd,
      gutter,
      pageRightStart,
      pageRightEnd,
      leafEdgesRightStart,
      leafEdgesRightWidth,
      leafEdgesRightEnd,
      bookWidth,
    };
  }

  /** @type {HTMLDimensionsCacher} Cache things like clientWidth to reduce repaints */
  htmlDimensionsCacher = new HTMLDimensionsCacher(this);

  smoothZoomer = new ModeSmoothZoom(this);

  /************** CONSTANT PROPERTIES **************/

  /** How much to zoom when zoom button pressed */
  ZOOM_FACTOR = 1.1;

  /** How thick a page is in the real world, as an estimate for the leafs */
  PAGE_THICKNESS_IN = 0.002;

  /****************************************/
  /************** PUBLIC API **************/
  /****************************************/

  /************** MAIN PUBLIC METHODS **************/

  /**
   * @param {PageIndex} index
   */
  jumpToIndex(index, { smooth = false } = {}) {

  }

  zoomIn() {
    this.scale *= this.ZOOM_FACTOR;
  }

  zoomOut() {
    this.scale *= 1 / this.ZOOM_FACTOR;
  }

  /********************************************/
  /************** INTERNAL STUFF **************/
  /********************************************/

  /************** LIFE CYCLE **************/

  /**
   * @param {BookModel} book
   * @param {BookReader} br
   */
  constructor(book, br) {
    super();
    this.book = book;

    /** @type {BookReader} */
    this.br = br;
  }

  /** @override */
  firstUpdated(changedProps) {
    super.firstUpdated(changedProps);
    this.htmlDimensionsCacher.updateClientSizes();
    this.smoothZoomer.attach();
  }

  /**
   * @param {PageIndex} startIndex
   */
  initFirstRender(startIndex) {
    const page = this.book.getPage(startIndex);
    this.visiblePages = [
      page,
      page.pageSide === 'R' ? page.left : page.right,
    ].filter(p => p);
    this.htmlDimensionsCacher.updateClientSizes();
    this.scale = this.computeDefaultScale(page);
  }

  /** @override */
  updated(changedProps) {
    // this.X is the new value
    // changedProps.get('X') is the old value
    if (changedProps.has('book')) {
      this.pages = genToArray(this.book.pagesIterator({ combineConsecutiveUnviewables: true }));
    }
    if (changedProps.has('visiblePages')) {
      this.throttledUpdateRenderedPages();
      this.br.displayedIndices = this.visiblePages.map(p => p.index);
      this.br.updateFirstIndex(this.br.displayedIndices[0]);
      this.br._components.navbar.updateNavIndexThrottled();
    }
    if (changedProps.has('scale')) {
      const oldVal = changedProps.get('scale');
      this.$book.style.transform = `scale(${this.scale})`;
      this.updateViewportOnZoom(this.scale, oldVal);
    }
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();
    this.htmlDimensionsCacher.attachResizeListener();
    this.smoothZoomer.attach();
  }

  /** @override */
  disconnectedCallback() {
    this.htmlDimensionsCacher.detachResizeListener();
    this.smoothZoomer.detach();
    super.disconnectedCallback();
  }

  /************** LIT CONFIGS **************/

  /** @override */
  createRenderRoot() {
    // Disable shadow DOM; that would require a huge rejiggering of CSS
    return this;
  }

  /************** COORDINATE SPACE CONVERTERS **************/
  /**
   * There are a few different "coordinate spaces" at play in BR:
   * (1) World units: i.e. inches. Unless otherwise stated, all computations
   *     are done in world units.
   * (2) Rendered Pixels: i.e. img.width = '300'. Note this does _not_ take
   *     into account zoom scaling.
   * (3) Visible Pixels: Just rendered pixels, but taking into account scaling.
   */

  worldUnitsToRenderedPixels = (/** @type {number} */inches) => inches * this.screenDPI / this.realWorldReduce;
  renderedPixelsToWorldUnits = (/** @type {number} */px) => px * this.realWorldReduce / this.screenDPI;

  renderedPixelsToVisiblePixels = (/** @type {number} */px) => px * this.scale;
  visiblePixelsToRenderedPixels = (/** @type {number} */px) => px / this.scale;

  worldUnitsToVisiblePixels = (/** @type {number} */px) => this.renderedPixelsToVisiblePixels(this.worldUnitsToRenderedPixels(px));
  visiblePixelsToWorldUnits = (/** @type {number} */px) => this.renderedPixelsToWorldUnits(this.visiblePixelsToRenderedPixels(px));

  /************** RENDERING **************/

  /** @override */
  render() {
    return html`
      <div class="br-mode-2up__book" @mouseup=${this.handlePageClick}>
        ${this.renderLeafEdges('left')}
        ${this.renderedPages.map(p => this.renderPage(p))}
        ${this.renderLeafEdges('right')}
      </div>`;
  }

  /**
   * @param {MouseEvent} ev
   */
  handlePageClick = (ev) => {
    // right click
    if (ev.which == 3 && this.br.protected) {
      return false;
    }

    if (ev.which != 1) return;

    const $page = $(ev.target).closest('.BRpagecontainer');
    if (!$page.length) return;
    if ($page.data('side') == 'L') this.flipAnimation('left');
    else if ($page.data('side') == 'R') this.flipAnimation('right');
  }

  /** @param {PageModel} page */
  createPageContainer = (page) => {
    return this.pageContainerCache[page.index] || (
      this.pageContainerCache[page.index] = (
        // @ts-ignore I know it's protected, TS! But Mode2Up and BookReader are friends.
        this.br._createPageContainer(page.index)
      )
    );
  }

  /**
   * @param {'left' | 'right'} side
   **/
  renderLeafEdges = (side) => {
    if (!this.visiblePages.length) return html``;
    const wToR = this.worldUnitsToRenderedPixels;
    const width = wToR(side == 'left' ? this.positions.leafEdgesLeftWidth : this.positions.leafEdgesRightWidth);
    const height = wToR(this.visiblePages[0].heightInches);
    const left = wToR(side == 'left' ? this.positions.leafEdgesLeftStart : this.positions.leafEdgesRightStart);
    return html`
      <div
        class="br-mode-2up__leafs br-mode-2up__leafs--${side}"
        style=${styleMap({width: `${width}px`, height: `${height}px`, left: `${left}px`})}
      ></div>
    `;
  }

  /** @param {PageModel} page */
  renderPage = (page) => {
    const wToR = this.worldUnitsToRenderedPixels;
    const wToV = this.worldUnitsToVisiblePixels;

    const width = wToR(page.widthInches);
    const height = wToR(page.heightInches);
    const isVisible = this.visiblePages.map(p => p.index).includes(page.index);
    const positions = this.computePositions(page.spread.left, page.spread.right);

    // const transform = `translate(${wToR(left)}px, ${wToR(top)}px)`;
    const pageContainerEl = this.createPageContainer(page)
      .update({
        dimensions: {
          width,
          height,
          top: 0,
          left: wToR(page.pageSide == 'L' ? positions.pageLeftStart : positions.pageLeftEnd),
        },
        reduce: page.width / wToV(page.widthInches),
      }).$container[0];

    // pageContainerEl.style.transform = transform;
    pageContainerEl.classList.toggle('BRpage-visible', isVisible);
    return pageContainerEl;
  }

  /************** VIRTUAL FLIPPING LOGIC **************/

  /**
   * @returns {PageModel[]}
   */
  computeRenderedPages() {
    // Also render 2 pages before/after
    // @ts-ignore TS doesn't understand the filtering out of null values
    return [
      this.visiblePages[0]?.prev?.prev,
      this.visiblePages[0]?.prev,
      ...this.visiblePages,
      this.visiblePages[this.visiblePages.length - 1]?.next,
      this.visiblePages[this.visiblePages.length - 1]?.next?.next,
    ]
      .filter(p => p)
      // Never render more than 10 pages! Usually means something is wrong
      .slice(0, 10);
  }

  throttledUpdateRenderedPages = throttle(() => {
    this.renderedPages = this.computeRenderedPages();
    this.requestUpdate();
  }, 100, null)

  /**
   * @param {PageModel} page
   * @returns {number}
   */
  computeDefaultScale(page) {
    // Default to real size if it fits, otherwise default to full height
    const containerHeightIn = this.visiblePixelsToWorldUnits(this.htmlDimensionsCacher.clientHeight);
    return Math.min(1, containerHeightIn / (page.heightInches + .1)) || 1;
  }

  /**
   * @param {'left' | 'right'} direction
   */
  async flipAnimation(direction) {
    if (!this.$pageLeft) return;

    // reveal the to be uncovered pages
    const curSpread = this.pageLeft.spread;
    const nextSpread = direction == 'left' ? curSpread.left.left.spread : curSpread.right.right.spread;

    this.classList.add(`br-mode-2up--flipping-${direction}`);
    this.classList.add(`BRpageFlipping`);
    const nextPageRightContainer = this.createPageContainer(nextSpread.right);
    const nextPageLeftContainer = this.createPageContainer(nextSpread.left);

    this.visiblePages
      .map(p => this.pageContainerCache[p.index].$container)
      .forEach($c => $c.addClass('BRpage-exiting'));
    nextPageRightContainer.$container.addClass('BRpage-visible BRpage-entering');
    nextPageLeftContainer.$container.addClass('BRpage-visible BRpage-entering');

    await Promise.race([
      promisifyEvent(nextPageRightContainer.$container[0], 'animationend'),
      promisifyEvent(nextPageLeftContainer.$container[0], 'animationend'),
      sleep(3500), // Fallback for browsers that don't support animationend
    ]);
    console.log('flip ended');

    this.classList.remove(`br-mode-2up--flipping-${direction}`);
    this.classList.remove(`BRpageFlipping`);
    this.visiblePages
      .map(p => this.pageContainerCache[p.index].$container)
      .forEach($c => $c.removeClass('BRpage-exiting BRpage-visible'));
    nextPageRightContainer.$container.removeClass('BRpage-entering');
    nextPageLeftContainer.$container.removeClass('BRpage-entering');

    this.visiblePages = [nextSpread.left, nextSpread.right].filter(x => x);
  }

  /************** ZOOMING LOGIC **************/

  /**
   * @param {number} newScale
   * @param {number} oldScale
   */
  updateViewportOnZoom(newScale, oldScale) {
    const container = this;
    const { scrollTop: T, scrollLeft: L } = container;
    const W = this.htmlDimensionsCacher.clientWidth;
    const H = this.htmlDimensionsCacher.clientHeight;

    // Scale factor change
    const F = newScale / oldScale;

    // Where in the viewport the zoom is centered on
    const XPOS = this.scaleCenter.x;
    const YPOS = this.scaleCenter.y;
    const oldCenter = {
      x: L + XPOS * W,
      y: T + YPOS * H,
    };
    const newCenter = {
      x: F * oldCenter.x,
      y: F * oldCenter.y,
    };
    container.scrollTop = newCenter.y - YPOS * H;
    container.scrollLeft = newCenter.x - XPOS * W;
  }
}
