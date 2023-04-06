// @ts-check
import { Mode2UpLit } from './Mode2UpLit.js';
import { DragScrollable } from './DragScrollable.js';
/** @typedef {import('../BookReader.js').default} BookReader */
/** @typedef {import('./BookModel.js').BookModel} BookModel */
/** @typedef {import('./BookModel.js').PageIndex} PageIndex */

export class Mode2Up {
  /**
   * @param {BookReader} br
   * @param {BookModel} bookModel
   */
  constructor(br, bookModel) {
    this.br = br;
    this.book = bookModel;
    this.mode2UpLit = new Mode2UpLit(bookModel, br);

    /** @private */
    this.$el = $(this.mode2UpLit)
      // We CANNOT use `br-mode-2up` as a class, because it's the same
      // as the name of the web component, and the webcomponents polyfill
      // uses the name of component as a class for style scoping 😒
      .addClass('br-mode-2up__root BRmode2up');

    /** Has mode2up ever been rendered before? */
    this.everShown = false;
  }

  // TODO: Might not need this anymore? Might want to delete.
  /** @private */
  get $brContainer() { return this.br.refs.$brContainer; }

  /**
   * This is called when we switch to one page view
   */
  prepare() {
    const startLeaf = this.br.currentIndex();
    console.log('Mode2Up.prepare', startLeaf);
    this.$brContainer
      .empty()
      .css({ overflow: 'hidden' })
      .append(this.$el);

    // Need this in a setTimeout so that it happens after the browser has _actually_
    // appended the element to the DOM
    setTimeout(async () => {
      if (!this.everShown) {
        this.mode2UpLit.initFirstRender(startLeaf);
        this.everShown = true;
        this.mode2UpLit.requestUpdate();
        await this.mode2UpLit.updateComplete;
        console.log('Mode2Up.prepare: init drag');
        new DragScrollable(this.mode2UpLit, {
          preventDefault: true,
          dragSelector: '.br-mode-2up__book',
          // Only handle mouse events; let browser/HammerJS handle touch
          dragstart: 'mousedown',
          dragcontinue: 'mousemove',
          dragend: 'mouseup',
        });
      }
      this.mode2UpLit.jumpToIndex(startLeaf);
    });
    this.br.updateBrClasses();
  }

  /**
   * BREAKING CHANGE: No longer supports pageX/pageY
   * @param {PageIndex} index
   * @param {number} [pageX] x position on the page (in pixels) to center on
   * @param {number} [pageY] y position on the page (in pixels) to center on
   * @param {boolean} [noAnimate]
   */
  jumpToIndex(index, pageX, pageY, noAnimate) {
    // Only smooth for small distances
    const distance = Math.abs(this.br.currentIndex() - index);
    const smooth = !noAnimate && distance <= 4;
    this.mode2UpLit.jumpToIndex(index, { smooth });
  }

  /**
   * @param {'in' | 'out'} direction
   */
  zoom(direction) {
    switch (direction) {
    case 'in':
      this.mode2UpLit.zoomIn();
      break;
    case 'out':
      this.mode2UpLit.zoomOut();
      break;
    default:
      console.error(`Unsupported direction: ${direction}`);
    }
  }

  /**
   * Resize the current one page view
   * Note this calls drawLeafs
   */
  resizePageView() {
    this.mode2UpLit.htmlDimensionsCacher.updateClientSizes();
    this.mode2UpLit.requestUpdate();
  }
}
