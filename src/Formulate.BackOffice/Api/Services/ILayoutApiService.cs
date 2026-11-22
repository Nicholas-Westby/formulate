namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Api.Models.Layout;
    using Formulate.BackOffice.Api.Models.Shared;

    /// <summary>
    /// Reads and changes layouts for the Management API.
    /// </summary>
    public interface ILayoutApiService
    {
        /// <summary>
        /// Gets a layout.
        /// </summary>
        ServiceResult<LayoutResponseModel> Get(Guid id);

        /// <summary>
        /// Creates a layout on a form.
        /// </summary>
        ServiceResult<LayoutResponseModel> Create(CreateLayoutRequestModel request);

        /// <summary>
        /// Replaces a layout's name, alias, template and configuration.
        /// </summary>
        ServiceResult<LayoutResponseModel> Update(Guid id, UpdateLayoutRequestModel request);

        /// <summary>
        /// Deletes a layout.
        /// </summary>
        ServiceResult<DeleteResponseModel> Delete(Guid id);
    }
}
