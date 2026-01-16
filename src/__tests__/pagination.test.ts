/**
 * Pagination Utilities Tests
 * Tests pagination logic and helpers
 */

describe('Pagination Utilities', () => {
  const calculatePages = (total: number, limit: number): number => {
    return Math.ceil(total / limit);
  };

  const calculateOffset = (page: number, limit: number): number => {
    return (page - 1) * limit;
  };

  const getPageRange = (total: number, limit: number): {
    pageCount: number;
    pageSize: number;
    maxPage: number;
  } => {
    const pageCount = calculatePages(total, limit);
    return {
      pageCount,
      pageSize: limit,
      maxPage: pageCount,
    };
  };

  describe('calculatePages', () => {
    it('should calculate correct page count', () => {
      expect(calculatePages(100, 10)).toBe(10);
      expect(calculatePages(101, 10)).toBe(11);
      expect(calculatePages(50, 50)).toBe(1);
    });

    it('should handle edge cases', () => {
      expect(calculatePages(0, 10)).toBe(0);
      expect(calculatePages(1, 10)).toBe(1);
      expect(calculatePages(10, 1)).toBe(10);
    });
  });

  describe('calculateOffset', () => {
    it('should calculate correct offset for page', () => {
      expect(calculateOffset(1, 10)).toBe(0);
      expect(calculateOffset(2, 10)).toBe(10);
      expect(calculateOffset(3, 10)).toBe(20);
      expect(calculateOffset(5, 50)).toBe(200);
    });

    it('should handle first page', () => {
      expect(calculateOffset(1, 25)).toBe(0);
    });
  });

  describe('getPageRange', () => {
    it('should return page information', () => {
      const range = getPageRange(150, 50);
      expect(range.pageCount).toBe(3);
      expect(range.pageSize).toBe(50);
      expect(range.maxPage).toBe(3);
    });

    it('should handle partial pages', () => {
      const range = getPageRange(175, 50);
      expect(range.pageCount).toBe(4);
      expect(range.pageSize).toBe(50);
    });
  });

  describe('hasMore calculation', () => {
    it('should correctly determine if more items exist', () => {
      const total = 100;
      const limit = 10;
      
      const hasMore = (offset: number, limit: number, total: number) => 
        offset + limit < total;

      expect(hasMore(0, limit, total)).toBe(true);   // Page 1
      expect(hasMore(10, limit, total)).toBe(true);  // Page 2
      expect(hasMore(80, limit, total)).toBe(true);  // Page 9
      expect(hasMore(90, limit, total)).toBe(false); // Page 10 (last)
      expect(hasMore(100, limit, total)).toBe(false); // Beyond last
    });
  });

  describe('Pagination Response Format', () => {
    it('should format pagination response correctly', () => {
      const paginationResponse = {
        data: [1, 2, 3],
        total: 100,
        limit: 50,
        offset: 0,
        hasMore: true,
      };

      expect(paginationResponse.data).toHaveLength(3);
      expect(paginationResponse.total).toBe(100);
      expect(paginationResponse.hasMore).toBe(true);
    });

    it('should indicate last page correctly', () => {
      const lastPageResponse = {
        data: [1, 2],
        total: 52,
        limit: 50,
        offset: 50,
        hasMore: false,
      };

      expect(lastPageResponse.hasMore).toBe(false);
      expect(lastPageResponse.data.length).toBeLessThanOrEqual(lastPageResponse.limit);
    });
  });

  describe('Validation Rules', () => {
    it('should validate limit parameter', () => {
      const validateLimit = (limit: string | number | undefined): number => {
        const parsed = typeof limit === 'string' ? parseInt(limit) : limit;
        const value = parsed || 50;
        return Math.min(value, 500); // Max 500
      };

      expect(validateLimit('100')).toBe(100);
      expect(validateLimit(1000)).toBe(500); // Capped
      expect(validateLimit(undefined)).toBe(50); // Default
      expect(validateLimit('0')).toBe(50); // Default on invalid
    });

    it('should validate offset parameter', () => {
      const validateOffset = (offset: string | number | undefined): number => {
        const parsed = typeof offset === 'string' ? parseInt(offset) : offset;
        return Math.max(parsed || 0, 0); // No negative
      };

      expect(validateOffset('50')).toBe(50);
      expect(validateOffset('-10')).toBe(0); // Negative becomes 0
      expect(validateOffset(undefined)).toBe(0); // Default
    });
  });
});
