namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Api.Models.Validation;
    using Formulate.BackOffice.Api.Models.Shared;

    /// <summary>
    /// Reads and changes validations for the Management API.
    /// </summary>
    public interface IValidationApiService
    {
        /// <summary>
        /// Gets an item.
        /// </summary>
        ServiceResult<ValidationResponseModel> Get(Guid id);

        /// <summary>
        /// Creates an item.
        /// </summary>
        ServiceResult<ValidationResponseModel> Create(CreateValidationRequestModel request);

        /// <summary>
        /// Replaces an item's content.
        /// </summary>
        ServiceResult<ValidationResponseModel> Update(Guid id, UpdateValidationRequestModel request);

        /// <summary>
        /// Deletes an item.
        /// </summary>
        ServiceResult<DeleteResponseModel> Delete(Guid id);
    }
}
