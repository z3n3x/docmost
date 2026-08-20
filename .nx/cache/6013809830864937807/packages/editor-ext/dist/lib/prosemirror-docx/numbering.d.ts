import { AlignmentType } from 'docx';
import { INumbering } from './types';
declare const styles: {
    numbered: {
        style?: {
            readonly run?: import("docx").IRunStylePropertiesOptions;
            readonly paragraph?: import("docx").ILevelParagraphStylePropertiesOptions;
            readonly style?: string;
        };
        alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
        level: number;
        format: any;
        text: string;
    }[];
    bullets: {
        style?: {
            readonly run?: import("docx").IRunStylePropertiesOptions;
            readonly paragraph?: import("docx").ILevelParagraphStylePropertiesOptions;
            readonly style?: string;
        };
        alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
        level: number;
        format: "bullet";
        text: any;
    }[];
};
export type NumberingStyles = keyof typeof styles;
export declare function createNumbering(reference: string, style: NumberingStyles): INumbering;
export {};
