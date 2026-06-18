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
export { default as LocatorMap } from "./LocatorMap";

// "CLASSIFIED" v3 HUD chrome primitives.
export { Panel } from "./Panel";
export { DossierNumber } from "./DossierNumber";
export { CodeLabel } from "./CodeLabel";
export { StatusTag } from "./StatusTag";
export { DecodeText } from "./DecodeText";
export { ScanFrame } from "./ScanFrame";
