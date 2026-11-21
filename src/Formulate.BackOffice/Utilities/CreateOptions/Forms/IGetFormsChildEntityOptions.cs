namespace Formulate.BackOffice.Utilities.CreateOptions.Forms
{
    using Formulate.BackOffice.Utilities.CreateOptions;
    using Formulate.Core.Persistence;
    using System.Collections.Generic;

    public interface IGetFormsChildEntityOptions
    {
        IReadOnlyCollection<CreateChildEntityOption> Get(IPersistedEntity? parent);
    }
}
