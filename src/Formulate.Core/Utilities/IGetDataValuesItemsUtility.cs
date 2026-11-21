namespace Formulate.Core.Utilities
{
    // Namespaces.
    using DataValues;
    using System;
    using System.Collections.Generic;

    /// <summary>
    /// A contract for creating a utility that gets the items from
    /// a <see cref="IDataValues"/>.
    /// </summary>
    public interface IGetDataValuesItemsUtility
    {
        /// <summary>
        /// Gets the values from a <see cref="IDataValues"/> for a given ID.
        /// </summary>
        /// <param name="id">
        /// The data values ID.
        /// </param>
        /// <param name="fieldId">
        /// The ID of the form field that uses the data values (used when logging a problem).
        /// </param>
        /// <returns>
        /// The data values, or no items when the data values cannot be found.
        /// </returns>
        IReadOnlyCollection<KeyValuePair<string, string>> GetValues(Guid id, Guid fieldId);
    }
}