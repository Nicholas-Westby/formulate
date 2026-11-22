namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Api.Models.Form;
    using Formulate.BackOffice.Api.Models.Shared;

    /// <summary>
    /// Reads and changes forms for the Management API.
    /// </summary>
    public interface IFormApiService
    {
        /// <summary>
        /// Gets a form.
        /// </summary>
        ServiceResult<FormResponseModel> Get(Guid id);

        /// <summary>
        /// Creates a form. Creating one of the basic layout kind also creates its layout.
        /// </summary>
        ServiceResult<FormResponseModel> Create(CreateFormRequestModel request);

        /// <summary>
        /// Replaces a form's name, alias, fields and handlers.
        /// </summary>
        ServiceResult<FormResponseModel> Update(Guid id, UpdateFormRequestModel request);

        /// <summary>
        /// Deletes a form and its layouts.
        /// </summary>
        ServiceResult<DeleteResponseModel> Delete(Guid id);

        /// <summary>
        /// Copies a form, with its layouts, giving everything new IDs.
        /// </summary>
        ServiceResult<FormResponseModel> Duplicate(Guid id, DuplicateFormRequestModel request);
    }
}
