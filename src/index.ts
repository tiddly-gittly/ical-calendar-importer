/* eslint-disable security-node/detect-insecure-randomness */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable typescript-sort-keys/interface */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Widget as IWidget, IChangedTiddlers, IParseTreeNode, IWidgetEvent, ITiddlerFieldsParam } from 'tiddlywiki';
import { lines2tree } from 'icalts';

const Widget = (require('$:/core/modules/widgets/widget.js') as { widget: typeof IWidget }).widget;

/**
 * Types from ICal file
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
  DTSTART?: string;
  DTEND?: string;
  DTSTAMP?: string;
  UID?: string;
  CREATED?: string;
  DESCRIPTION?: string;
  'LAST-MODIFIED'?: string;
  LOCATION?: string;
  SEQUENCE?: string;
  STATUS?: string;
  SUMMARY?: string;
  TRANSP?: string;
}
export interface ICalMetaData {
  CALSCALE?: string;
  METHOD?: string;
  PRODID?: string;
  VERSION?: string;
  VEVENT?: ICalEvent[];
  VTIMEZONE?: ICalTimeZone[];
  'X-WR-CALDESC'?: string;
  'X-WR-CALNAME'?: string;
  'X-WR-TIMEZONE'?: string;
}

export interface ICalTimeZone {
  TZID: string;
  'X-LIC-LOCATION': string;
  STANDARD: Standard[];
}

export interface Standard {
  TZOFFSETFROM: string;
  TZOFFSETTO: string;
  TZNAME: string;
  DTSTART: string;
}

/**
 * Type of created tiddlers
 * Tag tiddler for calendar category
 */
interface ICalendarCategoryTiddlerFields extends Partial<ITiddlerFieldsParam> {
  caption: string;
  color?: string;
  tags: string[];
  text: string;
  title: string;
  source?: string;
}
interface IEventTiddlerFields extends Partial<ITiddlerFieldsParam> {
  title: string;
  caption: string;
  text: string;
  tags: string[];
  startDate: string;
  endDate: string;
  created?: string;
  modified?: string;
  color?: string;
}

enum ImportMode {
  categories = 'categories',
  events = 'events',
}

class TransformICalWidget extends Widget {
  icalTiddlerTitleToImport?: string;
  titlePrefix?: string;
  eventOffset?: number;
  eventLimit?: number;
  rootTags?: string[];
  mode = ImportMode.categories;

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
    this.icalTiddlerTitleToImport = this.getAttribute('$icaltitle');
    this.titlePrefix = this.getAttribute('prefix');
    this.eventLimit = this.getAttribute('eventLimit') ? Number(this.getAttribute('eventLimit')) : undefined;
    this.eventOffset = this.getAttribute('eventOffset') ? Number(this.getAttribute('eventOffset')) : undefined;
    this.rootTags = (this.getAttribute('rootTags') ?? '').split(' ');
    this.mode = this.getAttribute('importEvent') === 'yes' ? ImportMode.events : ImportMode.categories;
    // Construct the child widgets
    this.makeChildWidgets();
  }

  invokeAction(_triggeringWidget: IWidget, _event: IWidgetEvent): boolean | undefined {
    if (!this.icalTiddlerTitleToImport) return false;
    const icalContent = $tw.wiki.getTiddlerText(this.icalTiddlerTitleToImport);
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
    const calendarInfo = (icalJSON.VCALENDAR as ICalMetaData[])[0];
    const {
      PRODID: source,
      'X-WR-CALDESC': description = '',
      'X-WR-CALNAME': title = String(Math.random()).substring(0, 5),
      'X-WR-TIMEZONE': timeZone,
      VEVENT: events,
    } = calendarInfo;

    const titlePrefix = this.titlePrefix ?? '';
    /**
     * Calendar name as tag (category) for event
     * If we have prefix, use it.
     */
    const buildTagTiddlerTitle = (categoryName: string) => `${titlePrefix}${categoryName}`;
    const buildEventTitle = (eventName: string, startDate: string) => `${titlePrefix}${eventName}-${startDate}`;
    const buildTWDate = (jsDateString: string) => $tw.utils.formatDateString(new Date(jsDateString), '[UTC]YYYY0MM0DD0hh0mm0ssXXX');

    const tagTiddlerFields: ICalendarCategoryTiddlerFields = {
      title: buildTagTiddlerTitle(title),
      caption: title,
      text: description,
      tags: this.rootTags ?? [],
      source,
      // ical don't have color info
      // color: '',
    };
    // update Categories only
    if (this.mode === ImportMode.categories) {
      $tw.wiki.addTiddler(tagTiddlerFields);
      return;
    }
    const eventTiddlerFields: IEventTiddlerFields[] = (events ?? [])
      .map((event): IEventTiddlerFields | undefined => {
        const { SUMMARY, DTSTART, DTEND, CREATED, DESCRIPTION } = event;
        if (!SUMMARY || !DTSTART || !DTEND) return undefined;
        return {
          title: buildEventTitle(SUMMARY, DTSTART),
          caption: SUMMARY,
          text: DESCRIPTION ?? '',
          startDate: buildTWDate(DTSTART),
          endDate: buildTWDate(DTEND),
          tags: [buildTagTiddlerTitle(title)],
          // ical don't have color info
          // color: backgroundColor,
          created: CREATED && $tw.utils.formatDateString(new Date(CREATED), '[UTC]YYYY0MM0DD0hh0mm0ssXXX'),
          timeZone,
        };
      })
      .filter((item): item is IEventTiddlerFields => item !== undefined)
      .slice(this.eventOffset, this.eventLimit);
    $tw.wiki.addTiddlers(eventTiddlerFields);
    return true; // Action was invoked
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
exports['action-transformical'] = TransformICalWidget;
