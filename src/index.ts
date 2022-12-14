/* eslint-disable security-node/detect-insecure-randomness */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable typescript-sort-keys/interface */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { Widget as IWidget, IChangedTiddlers, IParseTreeNode, IWidgetEvent, ITiddlerFieldsParam } from 'tiddlywiki';
import { lines2tree } from 'icalts';
import iCalDateParser from 'ical-date-parser';

const Widget = (require('$:/core/modules/widgets/widget.js') as { widget: typeof IWidget }).widget;

/**
 * {key: 'DTEND', __value__: '20141211', VALUE: 'DATE'}
 */
export interface ICalValueObject {
  key: string;
  /** this is the actual value */
  __value__: string;
  /** this is the value's type, for example, "DATE" */
  VALUE: string;
}
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
  DTSTART?: string | ICalValueObject;
  DTEND?: string | ICalValueObject;
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
  startDate?: string;
  endDate?: string;
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
  fallbackCategoryTitle?: string;
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
    this.fallbackCategoryTitle = this.getAttribute('fallbackCategoryTitle');
    this.eventLimit = this.getAttribute('eventLimit') ? Number(this.getAttribute('eventLimit')) : undefined;
    this.eventOffset = this.getAttribute('eventOffset') ? Number(this.getAttribute('eventOffset')) : undefined;
    this.rootTags = (this.getAttribute('rootTags') ?? '').split(' ').filter(Boolean);
    this.mode = this.getAttribute('importEvent') === 'yes' || this.getAttribute('importEvent') === 'true' ? ImportMode.events : ImportMode.categories;
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
      'X-WR-CALNAME': title = this.fallbackCategoryTitle,
      'X-WR-TIMEZONE': timeZone,
      VEVENT: events,
    } = calendarInfo;

    const titlePrefix = this.titlePrefix ?? '';
    /**
     * Calendar name as tag (category) for event
     * If we have prefix, use it.
     */
    const buildTagTiddlerTitle = (categoryName: string) => `${titlePrefix}${categoryName}`;
    const buildEventTitle = (eventName: string, startDate?: string) => `${titlePrefix}${eventName}${startDate ? `-${startDate}` : ''}`;
    const buildTWDate = (jsDateString: string) => {
      if (jsDateString.length === 8) {
        // fix 20081006
        jsDateString += 'T000000Z';
      }
      if (jsDateString.length === 15) {
        // sometimes will have `DTSTART;TZID=Asia/Shanghai:20201021T120000`, parsed as `20201021T120000`
        jsDateString += 'Z';
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return $tw.utils.formatDateString(iCalDateParser(jsDateString), '[UTC]YYYY0MM0DD0hh0mm0ssXXX');
    };

    if (!title) throw new Error('Calendar title is undefined, set fallbackCategoryTitle="xxx" to fix this');

    const now = $tw.utils.formatDateString(new Date(), '[UTC]YYYY0MM0DD0hh0mm0ssXXX');
    const tagTiddlerFields: ICalendarCategoryTiddlerFields = {
      title: buildTagTiddlerTitle(title),
      caption: title,
      text: description.replace(/\\n|<br\/>/g, '\n\n'),
      tags: this.rootTags ?? [],
      source,
      created: now,
      modified: now,
      // ical don't have color info
      // color: '',
    };
    this.setVariable('createTiddler-title', buildTagTiddlerTitle(title));
    this.refreshChildren();
    // update Categories only
    if (this.mode === ImportMode.categories) {
      $tw.wiki.addTiddler(tagTiddlerFields);
      return;
    }
    const eventTiddlerFields: IEventTiddlerFields[] = (events ?? [])
      .map((event): IEventTiddlerFields | undefined => {
        const { SUMMARY, DTSTART, DTEND, CREATED, DESCRIPTION, 'LAST-MODIFIED': LASTMODIFIED, UID } = event;
        if (!SUMMARY) return undefined;
        const startDate = DTSTART === undefined ? undefined : typeof DTSTART === 'string' ? buildTWDate(DTSTART) : buildTWDate(DTSTART.__value__);
        const endDate = DTEND === undefined ? undefined : typeof DTEND === 'string' ? buildTWDate(DTEND) : buildTWDate(DTEND.__value__);
        const created = CREATED ? buildTWDate(CREATED) : startDate ?? endDate ?? now;
        const modified = LASTMODIFIED ? buildTWDate(LASTMODIFIED) : endDate ?? startDate ?? now;
        return {
          title: buildEventTitle(SUMMARY, startDate),
          caption: SUMMARY,
          text: DESCRIPTION?.replace(/\\n|<br\/>/g, '\n\n') ?? '',
          startDate,
          endDate,
          tags: [buildTagTiddlerTitle(title)],
          // ical don't have color info
          // color: backgroundColor,
          uid: UID,
          /**
           * this `calendarEntry` is used for cascade that ask tiddler only show caption
           * See $:/plugins/linonetwo/tw-calendar/calendar-widget/tiddlywiki-ui/ViewTemplate/captionCascade
           */
          calendarEntry: 'yes',
          created,
          modified,
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
