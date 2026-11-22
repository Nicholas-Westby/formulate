namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Api.Models.DataValues;
    using Formulate.BackOffice.Api.Models.Shared;

    /// <summary>
    /// Reads and changes data values for the Management API.
    /// </summary>
    public interface IDataValuesApiService
    {
        /// <summary>
        /// Gets an item.
        /// </summary>
        ServiceResult<DataValuesResponseModel> Get(Guid id);

        /// <summary>
        /// Creates an item.
        /// </summary>
        ServiceResult<DataValuesResponseModel> Create(CreateDataValuesRequestModel request);

        /// <summary>
        /// Replaces an item's content.
        /// </summary>
        ServiceResult<DataValuesResponseModel> Update(Guid id, UpdateDataValuesRequestModel request);

        /// <summary>
        /// Deletes an item.
        /// </summary>
        ServiceResult<DeleteResponseModel> Delete(Guid id);
    }
}
