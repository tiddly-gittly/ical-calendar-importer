/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable typescript-sort-keys/interface */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Widget as IWidget, IChangedTiddlers, IParseTreeNode, IWidgetEvent } from 'tiddlywiki';
import { lines2tree } from 'icalts';
import { TreeType } from 'icalts/dist/src/types';

const Widget = (require('$:/core/modules/widgets/widget.js') as { widget: typeof IWidget }).widget;

/**
 * ```json
 * {
    "DTSTART": "20200429T180000Z",
    "DTEND": "20200430T010000Z",
    "DTSTAMP": "20221204T131222Z",
    "UID": "5021i3f5r1ophglm0spajd2b5u@google.com",
    "CREATED": "20200430T013719Z",
    "DESCRIPTION": "",
    "LAST-MODIFIED": "20200430T013724Z",
    "LOCATION": "",
    "SEQUENCE": "1",
    "STATUS": "CONFIRMED",
    "SUMMARY": "睡觉",
    "TRANSP": "OPAQUE"
  }
  ```
 */
export interface ICalEvent {
  DTSTART: string;
  DTEND: string;
  DTSTAMP: string;
  UID: string;
  CREATED: string;
  DESCRIPTION: string;
  'LAST-MODIFIED': string;
  LOCATION: string;
  SEQUENCE: string;
  STATUS: string;
  SUMMARY: string;
  TRANSP: string;
}

class TransformICalWidget extends Widget {
  icalTiddlerTitle?: string;

  constructor(parseTreeNode: IParseTreeNode, options?: unknown) {
    super(parseTreeNode, options);
    this.initialise(parseTreeNode, options as any);
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
    this.icalTiddlerTitle = this.getAttribute('$icaltitle');
    // Construct the child widgets
    this.makeChildWidgets();
  }

  invokeAction(_triggeringWidget: IWidget, _event: IWidgetEvent): boolean | undefined {
    if (!this.icalTiddlerTitle) return false;
    const icalContent = $tw.wiki.getTiddlerText(this.icalTiddlerTitle);
    if (!icalContent) return false;
    /**
     * {VCALENDAR: Array(1)}
          VCALENDAR: Array(1)
            0:
     */
    const icalJSON = lines2tree(icalContent.split(/\r\n|\n|\r/g));
    /**
     *  CALSCALE: "GREGORIAN"
        METHOD: "PUBLISH"
        PRODID: "-//Google Inc//Google Calendar 70.9054//EN"
        VERSION: "2.0"
        VEVENT: (3972) [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, …]
        VTIMEZONE: [{…}]
        X-WR-CALDESC: "任务类型\\n吃饭...的运维活动。"
        X-WR-CALNAME: "运维通勤"
        X-WR-TIMEZONE: "Asia/Shanghai"
     */
    const calendarInfo = (icalJSON.VCALENDAR as TreeType[])[0];
    const { PRODID: source, 'X-WR-CALDESC': description, 'X-WR-CALNAME': title, 'X-WR-TIMEZONE': timeZone, VEVENT: events } = calendarInfo;
    (events as TreeType[] as unknown as ICalEvent[]).forEach((event) => {});
    return true; // Action was invoked
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
exports['action-transformical'] = TransformICalWidget;
