import type { Widget as IWidget, IChangedTiddlers, IParseTreeNode } from 'tiddlywiki';

const Widget = (require('$:/core/modules/widgets/widget.js') as { widget: typeof IWidget }).widget;

class TransformICalWidget extends Widget {
  icalTiddlerTitle?: string;

  constructor(parseTreeNode: IParseTreeNode, options?: unknown) {
    super(parseTreeNode, options);
    this.initialise(parseTreeNode, options);
  }

  refresh(changedTiddlers: IChangedTiddlers): boolean {
    const changedAttributes = this.computeAttributes();
    if ($tw.utils.count(changedAttributes) > 0) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }

  /**
   * Lifecycle method: Render this widget into the DOM
   */
  render(parent: Node, nextSibling: Node): void {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();
    // Render children
    this.renderChildren(parent, nextSibling);
  }

  execute(): void {
    // DEBUG: console
    console.log(`this.getAttribute('$icaltitle')`, this.getAttribute('$icaltitle'));
    this.icalTiddlerTitle = this.getAttribute('$icaltitle');
    // Construct the child widgets
    this.makeChildWidgets();
  }

  invokeAction(triggeringWidget, event): void {
    // DEBUG: console
    console.log(`triggeringWidget`, triggeringWidget);
    // DEBUG: console
    console.log(`event`, event);
    // DEBUG: console
    console.log(`this.icalTiddlerTitle`, this.icalTiddlerTitle);
    this.refreshChildren();
    return true; // Action was invoked
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
exports['action-transformical'] = TransformICalWidget;
