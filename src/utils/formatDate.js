const formatDateToIST = (records) => {
    const toISTFormat = (date) => {
      if (!date) return null;
      const istDate = new Date(date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      // Convert "DD/MM/YYYY, HH:MM:SS" to "DD-MM-YYYY HH:MM:SS"
      const [datePart, timePart] = istDate.split(', ');
      const [day, month, year] = datePart.split('/');
      return `${day}-${month}-${year} ${timePart}`;
    };
  
    if (Array.isArray(records)) {
      return records.map((record) => ({
        ...record,
        createdAt: toISTFormat(record.createdAt),
        updatedAt: toISTFormat(record.updatedAt),
      }));
    }
  
    return {
      ...records,
      createdAt: toISTFormat(records.createdAt),
      updatedAt: toISTFormat(records.updatedAt),
    };
  };
  export { formatDateToIST };