/**
 * Shared UI primitive layer for the First Light dark system. Pages import from
 * "../components/ui". This barrel also re-exports the existing Tooltip / InfoTip
 * and the LocatorMap so call sites have a single entry point.
 */
export { Card } from "./Card";
export { Button } from "./Button";
export type { ButtonProps } from "./Button";
export { Input, Textarea } from "./Field";
export type { InputProps, TextareaProps } from "./Field";
export { Badge } from "./Badge";
export { Spinner, EmptyState } from "./Feedback";
export { PageHeader, Section } from "./Page";

export { Tooltip, InfoTip } from "./Tooltip";
// NOTE: LocatorMap is intentionally NOT re-exported here. It pulls in leaflet and
// its CSS, and this barrel is imported app-wide (e.g. by Layout), so re-exporting
// it would force leaflet into the entry chunk. Import it lazily where it is used.

// "CLASSIFIED" v3 HUD chrome primitives.
export { Panel } from "./Panel";
export { Tabs } from "./Tabs";
export type { TabItem } from "./Tabs";
export { DossierNumber } from "./DossierNumber";
export { CodeLabel } from "./CodeLabel";
export { StatusTag } from "./StatusTag";
export { DecodeText } from "./DecodeText";
export { ScanFrame } from "./ScanFrame";
