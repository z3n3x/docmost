import { AlignmentType } from 'docx';
import { INumbering } from './types';
declare const styles: {
    numbered: {
        alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
        style?: {
            readonly run?: import("docx").IRunStylePropertiesOptions;
            readonly paragraph?: import("docx").ILevelParagraphStylePropertiesOptions;
            readonly style?: string;
        };
        level: number;
        format: any;
        text: string;
    }[];
    bullets: {
        alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
        style?: {
            readonly run?: import("docx").IRunStylePropertiesOptions;
            readonly paragraph?: import("docx").ILevelParagraphStylePropertiesOptions;
            readonly style?: string;
        };
        level: number;
        format: "bullet";
        text: any;
    }[];
};
export type NumberingStyles = keyof typeof styles;
export declare function createNumbering(reference: string, style: NumberingStyles): INumbering;
export {};
