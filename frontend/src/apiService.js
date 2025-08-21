
import { showToast } from './utils/helpers.js';

/**
 * A service for handling all API interactions using the Fetch API.
 * This module is designed as an Immediately Invoked Function Expression (IIFE)
 * to encapsulate its private variables and functions, exposing only
 * the necessary public interface.
 */
export const apiService = (() => {
    // The base URL for the API.
    const API_BASE_URL = 'https://smsv2-liart.vercel.app';

    // A Set to efficiently check which collections require the '/financial' prefix.
    const financialCollections = new Set(['fees', 'salaries', 'expenses']);

    /**
     * Determines the correct base URL for a given collection, adding a
     * '/financial' prefix if needed.
     * @param {string} collection - The name of the collection (e.g., 'fees', 'students').
     * @returns {string} The full base URL for the collection.
     */
    const getBaseUrlForCollection = (collection) => {
        if (financialCollections.has(collection)) {
            return `${API_BASE_URL}/financial/${collection}`;
        }
        return `${API_BASE_URL}/${collection}`;
    };

    /**
     * Maps an item's '_id' field to 'id' for frontend consistency.
     * @param {object} item - The object to map.
     * @returns {object} The mapped object.
     */
    const mapId = (item) => {
        if (item && item._id) item.id = item._id.toString();
        return item;
    };

    /**
     * Maps the '_id' to 'id' for every item in an array.
     * @param {Array<object>} arr - The array of objects.
     * @returns {Array<object>} The array with mapped IDs.
     */
    const mapIdInArray = (arr) => Array.isArray(arr) ? arr.map(mapId) : [];

    // --- Core API Functions using Fetch ---

    // Placeholder for initialization.
    const init = () => Promise.resolve();
    const save = () => Promise.resolve();
    const reset = () => { /* Requires dedicated backend endpoint */ };

    /**
     * Fetches data from a given collection or sub-collection.
     * @param {string} collection - The main collection name.
     * @param {string | null} [subCollection=null] - An optional sub-collection.
     * @returns {Promise<Array<object> | object>} A promise that resolves to the fetched data.
     */
    const get = async (collection, subCollection = null) => {
        const baseUrl = getBaseUrlForCollection(collection);
        const url = subCollection ? `${baseUrl}/${subCollection}` : baseUrl;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                // Throw an error that includes the status for better debugging
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return Array.isArray(data) ? mapIdInArray(data) : mapId(data);
        } catch (error) {
            console.error(`Failed to GET from ${url}:`, error);
            showToast('Error: Could not fetch data from the server.', 'error');
            
            // ROBUST FIX: Always return an empty array for a failed collection fetch.
            // This prevents the TypeError: .map is not a function.
            return []; 
        }
    };

    /**
     * Creates a new item in a specified collection.
     * @param {string} collection - The collection name.
     * @param {object} data - The data to create.
     * @param {string | null} [subCollection=null] - An optional sub-collection.
     * @returns {Promise<object | undefined>} The created item or undefined on failure.
     */
    const create = async (collection, data, subCollection = null) => {
        const baseUrl = getBaseUrlForCollection(collection);
        const url = subCollection ? `${baseUrl}/${subCollection}` : baseUrl;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            return mapId(await response.json());
        } catch (error) {
            console.error(`Failed to CREATE in ${collection}:`, error);
            showToast('Error: Could not save the new item.', 'error');
            return undefined;
        }
    };

    /**
     * Performs a bulk creation of items in a collection.
     * @param {string} collection - The collection name.
     * @param {Array<object>} data - The array of items to create.
     * @returns {Promise<object>} An object with the results of the bulk operation.
     */
    const bulkCreate = async (collection, data) => {
        const url = `${getBaseUrlForCollection(collection)}/bulk`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include',
                body: JSON.stringify(data),
            });
            // 207 Multi-Status is a valid response for bulk operations
            if (!response.ok && response.status !== 207) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to BULK CREATE in ${collection}:`, error);
            showToast('Error: Could not send bulk data to the server.', 'error');
            return { success: false, insertedCount: 0, failedCount: data.length };
        }
    };
    
    /**
     * Performs a bulk removal of items from a collection.
     * @param {string} collection - The collection name.
     * @param {Array<string>} ids - An array of IDs to remove.
     * @returns {Promise<object>} An object with the results of the bulk operation.
     */
    const bulkRemove = async (collection, ids) => {
        const url = `${getBaseUrlForCollection(collection)}/bulk`;
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include',
                body: JSON.stringify({ ids }),
            });
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Failed to BULK REMOVE from ${collection}:`, error);
            showToast('Error: Could not delete the selected items.', 'error');
            return { success: false };
        }
    };


    /**
     * Updates an existing item in a collection.
     * @param {string} collection - The collection name.
     * @param {string} id - The ID of the item to update.
     * @param {object} data - The data to update.
     * @param {string | null} [subCollection=null] - An optional sub-collection.
     * @returns {Promise<object | undefined>} The updated item or undefined on failure.
     */
    const update = async (collection, id, data, subCollection = null) => {
        const baseUrl = getBaseUrlForCollection(collection);
        const url = subCollection ? `${baseUrl}/${subCollection}/${id}` : `${baseUrl}/${id}`;
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            return mapId(await response.json());
        } catch (error) {
            console.error(`Failed to UPDATE in ${collection}:`, error);
            showToast('Error: Could not update the item.', 'error');
            return undefined;
        }
    };

    /**
     * Removes an item from a collection.
     * @param {string} collection - The collection name.
     * @param {string} id - The ID of the item to remove.
     * @param {string | null} [subCollection=null] - An optional sub-collection.
     * @returns {Promise<object>} An object indicating success.
     */
    const remove = async (collection, id, subCollection = null) => {
        const baseUrl = getBaseUrlForCollection(collection);
        const url = subCollection ? `${baseUrl}/${subCollection}/${id}` : `${baseUrl}/${id}`;
        
        try {
            const response = await fetch(url, { method: 'DELETE' });
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Failed to REMOVE from ${collection}:`, error);
            showToast('Error: Could not delete the item.', 'error');
            return { success: false };
        }
    };

    /**
     * Processes salaries by sending data to a specific endpoint.
     * @param {object} data - The salary data to process.
     * @returns {Promise<object | undefined>} The response from the server or undefined on failure.
     */
    const processSalaries = async (data) => {
        const url = `${API_BASE_URL}/financial/salaries/process`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to process salaries:', error);
            showToast('Error: Could not process monthly salaries.', 'error');
            return undefined;
        }
    };

    // Placeholder functions for exam results.
    const getResultsForExam = (examId) => Promise.resolve([]);
    const saveResults = (examId, resultsData) => Promise.resolve({ success: true });

    /**
     * Fetches attendance data for a specific section and date.
     * @param {string} sectionId - The ID of the section.
     * @param {string} date - The date in a suitable format (e.g., YYYY-MM-DD).
     * @returns {Promise<object>} The attendance data or an empty object on error.
     */
    const getAttendance = async (sectionId, date) => {
        try {
            const response = await fetch(`${API_BASE_URL}/attendance/${sectionId}/${date}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Failed to get attendance sheet:', error);
            return {}; // Return empty map on error
        }
    };
    
    /**
     * Saves attendance data.
     * @param {object} data - The attendance data to save, including date, sectionId, records, and markedBy.
     * @returns {Promise<object>} An object indicating success.
     */
    const saveAttendance = async (data) => {
        try {
            const response = await fetch(`${API_BASE_URL}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Failed to save attendance:', error);
            return { success: false };
        }
    };
    
    /**
     * Fetches an attendance report for a student or section.
     * @param {string} type - The type of report ('student' or 'section').
     * @param {string} id - The ID of the student or section.
     * @param {object} params - Optional search parameters (e.g., date ranges).
     * @returns {Promise<Array<object>>} An array of report data or an empty array on error.
     */
    const getAttendanceReport = async (type, id, params) => {
        const url = new URL(`${API_BASE_URL}/attendance/report/${type}/${id}`);
        if (params) url.search = new URLSearchParams(params).toString();
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error(`Failed to get ${type} attendance report:`, error);
            return [];
        }
    };


    // Public interface of the apiService module.
    return {
        init, save, get, create, bulkCreate, bulkRemove, getAttendanceReport,
        update, remove, getAttendance, saveAttendance,
        getResultsForExam, saveResults, reset, processSalaries 
    };
})();
