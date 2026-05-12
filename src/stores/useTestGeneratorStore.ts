import { create } from 'zustand';

export interface GeneratedTest {
  id: string;
  name: string;
  code: string;
  framework: 'jest' | 'vitest' | 'mocha' | 'pytest' | 'go-test';
  coverage: number;
  file: string;
  targetFunction: string;
  edgeCases: string[];
  status: 'pending' | 'generated' | 'applied';
}

interface TestGeneratorState {
  tests: GeneratedTest[];
  isGenerating: boolean;
  selectedFramework: 'jest' | 'vitest' | 'mocha' | 'pytest' | 'go-test';
  coverageTarget: number;
  includeEdgeCases: boolean;
  
  // Actions
  generateTests: (file: string, code: string) => Promise<void>;
  addTest: (test: GeneratedTest) => void;
  removeTest: (id: string) => void;
  applyTest: (id: string) => void;
  setFramework: (framework: GeneratedTest['framework']) => void;
  setCoverageTarget: (target: number) => void;
  setIncludeEdgeCases: (include: boolean) => void;
  clearTests: () => void;
}

export const useTestGeneratorStore = create<TestGeneratorState>((set, get) => ({
  tests: [],
  isGenerating: false,
  selectedFramework: 'jest',
  coverageTarget: 80,
  includeEdgeCases: true,

  generateTests: async (file: string, _code: string) => {
    set({ isGenerating: true });

    // Mock AI test generation (in real implementation, call AI API)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockTest: GeneratedTest = {
      id: `test-${Date.now()}`,
      name: 'should handle valid input',
      code: `describe('myFunction', () => {
  it('should handle valid input', () => {
    const result = myFunction('test');
    expect(result).toBe('TEST');
  });

  it('should handle edge cases', () => {
    expect(myFunction('')).toBe('');
    expect(myFunction(null)).toThrow();
  });
});`,
      framework: get().selectedFramework,
      coverage: 85,
      file,
      targetFunction: 'myFunction',
      edgeCases: ['empty string', 'null input', 'undefined'],
      status: 'generated',
    };

    set((s) => ({
      tests: [...s.tests, mockTest],
      isGenerating: false,
    }));
  },

  addTest: (test) => set((s) => ({
    tests: [...s.tests, test]
  })),

  removeTest: (id) => set((s) => ({
    tests: s.tests.filter(t => t.id !== id)
  })),

  applyTest: (id) => set((s) => ({
    tests: s.tests.map(t => 
      t.id === id ? { ...t, status: 'applied' as const } : t
    )
  })),

  setFramework: (framework) => set({ selectedFramework: framework }),
  
  setCoverageTarget: (target) => set({ coverageTarget: target }),
  
  setIncludeEdgeCases: (include) => set({ includeEdgeCases: include }),
  
  clearTests: () => set({ tests: [] }),
}));
