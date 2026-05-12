import { create } from 'zustand';

export interface GeneratedDoc {
  id: string;
  type: 'jsdoc' | 'tsdoc' | 'readme' | 'api' | 'changelog' | 'comment';
  title: string;
  content: string;
  file: string;
  targetElement?: string;
  status: 'pending' | 'generated' | 'applied';
}

interface DocsGeneratorState {
  docs: GeneratedDoc[];
  isGenerating: boolean;
  selectedType: GeneratedDoc['type'];
  includeExamples: boolean;
  includeTypes: boolean;
  
  // Actions
  generateDocs: (file: string, code: string, type: GeneratedDoc['type']) => Promise<void>;
  addDoc: (doc: GeneratedDoc) => void;
  removeDoc: (id: string) => void;
  applyDoc: (id: string) => void;
  setType: (type: GeneratedDoc['type']) => void;
  setIncludeExamples: (include: boolean) => void;
  setIncludeTypes: (include: boolean) => void;
  clearDocs: () => void;
}

export const useDocsGeneratorStore = create<DocsGeneratorState>((set) => ({
  docs: [],
  isGenerating: false,
  selectedType: 'jsdoc',
  includeExamples: true,
  includeTypes: true,

  generateDocs: async (file: string, _code: string, type: GeneratedDoc['type']) => {
    set({ isGenerating: true });

    // Mock AI docs generation (in real implementation, call AI API)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockDocs: Record<GeneratedDoc['type'], string> = {
      jsdoc: `/**
 * Converts a string to uppercase
 * @param {string} input - The input string to convert
 * @returns {string} The uppercase version of the input
 * @throws {TypeError} If input is not a string
 * @example
 * myFunction('hello') // returns 'HELLO'
 */`,
      tsdoc: `/**
 * Converts a string to uppercase
 * @param input - The input string to convert
 * @returns The uppercase version of the input
 * @throws {@link TypeError} If input is not a string
 * @example
 * \`\`\`typescript
 * myFunction('hello') // returns 'HELLO'
 * \`\`\`
 */`,
      readme: `# Project Name

## Description
A brief description of your project.

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`javascript
import { myFunction } from './myFunction';
const result = myFunction('hello');
\`\`\`

## API
See [API Documentation](./docs/api.md)

## License
MIT`,
      api: `# API Documentation

## myFunction(input: string): string

Converts a string to uppercase.

### Parameters
- \`input\` (string): The input string to convert

### Returns
- (string): The uppercase version of the input

### Example
\`\`\`typescript
myFunction('hello') // returns 'HELLO'
\`\`\``,
      changelog: `# Changelog

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial release
- myFunction implementation

### Changed
- N/A

### Fixed
- N/A`,
      comment: `// Converts input string to uppercase
// Returns the transformed string`,
    };

    const mockDoc: GeneratedDoc = {
      id: `doc-${Date.now()}`,
      type,
      title: `${type} for ${file}`,
      content: mockDocs[type],
      file,
      targetElement: type === 'jsdoc' || type === 'tsdoc' ? 'myFunction' : undefined,
      status: 'generated',
    };

    set((s) => ({
      docs: [...s.docs, mockDoc],
      isGenerating: false,
    }));
  },

  addDoc: (doc) => set((s) => ({
    docs: [...s.docs, doc]
  })),

  removeDoc: (id) => set((s) => ({
    docs: s.docs.filter(d => d.id !== id)
  })),

  applyDoc: (id) => set((s) => ({
    docs: s.docs.map(d => 
      d.id === id ? { ...d, status: 'applied' as const } : d
    )
  })),

  setType: (type) => set({ selectedType: type }),
  
  setIncludeExamples: (include) => set({ includeExamples: include }),
  
  setIncludeTypes: (include) => set({ includeTypes: include }),
  
  clearDocs: () => set({ docs: [] }),
}));
