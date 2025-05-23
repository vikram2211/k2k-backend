export const getPaginationParams = (page, pageSize) => {
    const pageNumber = Number(page) || 1;
    const pageLimit = Number(pageSize) || 5;
    const skip = (pageNumber - 1) * pageLimit;
  
    return { skip, limit: pageLimit };
  };
  
  